from __future__ import annotations

import logging
import mimetypes
import os
import subprocess
import tempfile
import time
from typing import Optional

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """角色： 你是一位文字修辞专家，擅长在不改变原意和叙事节奏的前提下，将杂乱的口语稿转化为流畅、专业的成文稿。

任务： 请对以下原始录音文本进行"无损精修"。

精修要求：

1. 禁止总结：严禁将内容缩减为摘要、大纲或要点。我需要的是完整的叙述，不是结论。

2. 彻底去噪：删掉所有语气词（如：那个、就是、嗯、啊、然后、那么、的话）、无意义的口头禅，以及讲者因为思考而产生的停顿重复。

3. 句式优化：修复口语中的病句、断句和倒装。将松散的口语短句组合成逻辑连贯的长句，使其符合书面阅读习惯。

4. 消除冗余：如果一句话在文中反复说了三遍（车轮话），请将其合并成一句表达最完整、最清晰的话，但不要漏掉任何细节。

5. 保留第一人称：维持讲者的第一人称叙事，保留讲者的语言风格和特定术语，不要写成冷冰冰的第三方报告。

6. 分段排版：根据内容逻辑自然分段，增加易读性。

输出格式：

• 使用 Markdown 格式输出。
• 第一行必须是一个一级标题（# 标题），用一句简短的话概括录音的核心主题，作为标题摘要。
• 标题之后是精修后的正文，不要任何开场白或结尾客套话。"""

MODEL = "gemini-2.5-flash"
GEMINI_SUPPORTED_MIMES = {"audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/flac", "audio/aac"}

# Reuse client across calls to avoid repeated initialization
_client: Optional[genai.Client] = None

# Files larger than 20MB must use the Files API; smaller ones use inline data
_INLINE_MAX_BYTES = 20 * 1024 * 1024


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _convert_to_mp3(input_path: str) -> str:
    """Convert audio file to mp3 using ffmpeg. Returns path to temp mp3 file."""
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp.close()
    subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", tmp.name],
        check=True,
        capture_output=True,
    )
    logger.info("Converted %s -> %s (%d bytes)", input_path, tmp.name, os.path.getsize(tmp.name))
    return tmp.name


def transcribe_audio(audio_file_path: str) -> str:
    """Send audio to Gemini and generate structured text."""
    t0 = time.monotonic()

    mime_type, _ = mimetypes.guess_type(audio_file_path)
    if mime_type is None:
        mime_type = "audio/webm"

    # Convert unsupported formats to mp3
    converted_path = None
    if mime_type not in GEMINI_SUPPORTED_MIMES:
        converted_path = _convert_to_mp3(audio_file_path)
        audio_path = converted_path
        audio_mime = "audio/mpeg"
    else:
        audio_path = audio_file_path
        audio_mime = mime_type

    try:
        client = _get_client()
        file_size = os.path.getsize(audio_path)

        if file_size <= _INLINE_MAX_BYTES:
            # Inline data — single API call, much faster
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
            audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime)
            logger.info("Using inline data: %d bytes, mime=%s", file_size, audio_mime)
        else:
            # Large file — must use Files API (upload + reference)
            audio_part = client.files.upload(
                file=audio_path,
                config={"mime_type": audio_mime},
            )
            logger.info("Uploaded via Files API: name=%s size=%d", audio_part.name, file_size)

        response = client.models.generate_content(
            model=MODEL,
            contents=[audio_part, SYSTEM_PROMPT],
        )

        elapsed = time.monotonic() - t0
        logger.info("Gemini completed in %.1fs for %s", elapsed, audio_file_path)
        return response.text
    finally:
        if converted_path:
            os.unlink(converted_path)
