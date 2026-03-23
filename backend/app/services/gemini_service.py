from __future__ import annotations

import logging
import mimetypes
import os
import subprocess
import tempfile

from google import genai

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

输出规则：

• 直接输出精修后的全文，不要任何开场白或结尾客套话。"""

MODEL = "gemini-2.5-flash"
GEMINI_SUPPORTED_MIMES = {"audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/flac", "audio/aac"}


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
    """Upload audio to Gemini via SDK, then generate structured text."""
    mime_type, _ = mimetypes.guess_type(audio_file_path)
    if mime_type is None:
        mime_type = "audio/webm"

    # Convert unsupported formats to mp3
    converted_path = None
    if mime_type not in GEMINI_SUPPORTED_MIMES:
        converted_path = _convert_to_mp3(audio_file_path)
        upload_path = converted_path
        upload_mime = "audio/mpeg"
    else:
        upload_path = audio_file_path
        upload_mime = mime_type

    try:
        client = genai.Client(api_key=settings.gemini_api_key)

        uploaded_file = client.files.upload(
            file=upload_path,
            config={"mime_type": upload_mime},
        )
        logger.info("Uploaded file: name=%s state=%s", uploaded_file.name, uploaded_file.state)

        response = client.models.generate_content(
            model=MODEL,
            contents=[uploaded_file, SYSTEM_PROMPT],
        )

        return response.text
    finally:
        if converted_path:
            os.unlink(converted_path)
