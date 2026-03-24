"""Convert Markdown to TipTap-compatible JSON document format."""
from __future__ import annotations

from markdown_it import MarkdownIt


def markdown_to_tiptap(markdown: str) -> dict:
    """Parse Markdown and convert to TipTap JSON document."""
    md = MarkdownIt()
    tokens = md.parse(markdown)
    doc_content = _convert_tokens(tokens)
    return {"type": "doc", "content": doc_content}


def _convert_tokens(tokens: list) -> list[dict]:
    """Walk tokens and produce TipTap nodes."""
    result: list[dict] = []
    i = 0
    while i < len(tokens):
        token = tokens[i]

        if token.type == "heading_open":
            level = int(token.tag[1])  # h1 -> 1, h2 -> 2
            inline_token = tokens[i + 1] if i + 1 < len(tokens) else None
            content = _inline_to_content(inline_token) if inline_token else []
            result.append({
                "type": "heading",
                "attrs": {"level": level},
                "content": content,
            })
            i += 3  # heading_open, inline, heading_close
            continue

        if token.type == "paragraph_open":
            inline_token = tokens[i + 1] if i + 1 < len(tokens) else None
            content = _inline_to_content(inline_token) if inline_token else []
            if content:
                result.append({"type": "paragraph", "content": content})
            else:
                result.append({"type": "paragraph"})
            i += 3  # paragraph_open, inline, paragraph_close
            continue

        if token.type == "bullet_list_open":
            items, consumed = _collect_list_items(tokens, i + 1, "bullet_list_close")
            result.append({"type": "bulletList", "content": items})
            i += consumed + 2  # +1 for open, +1 for close
            continue

        if token.type == "ordered_list_open":
            items, consumed = _collect_list_items(tokens, i + 1, "ordered_list_close")
            result.append({"type": "orderedList", "content": items})
            i += consumed + 2
            continue

        if token.type == "blockquote_open":
            # Collect content until blockquote_close
            inner_tokens = []
            depth = 1
            j = i + 1
            while j < len(tokens):
                if tokens[j].type == "blockquote_open":
                    depth += 1
                elif tokens[j].type == "blockquote_close":
                    depth -= 1
                    if depth == 0:
                        break
                inner_tokens.append(tokens[j])
                j += 1
            inner_content = _convert_tokens(inner_tokens)
            result.append({"type": "blockquote", "content": inner_content})
            i = j + 1
            continue

        if token.type == "fence" or token.type == "code_block":
            result.append({
                "type": "codeBlock",
                "attrs": {"language": token.info or None},
                "content": [{"type": "text", "text": token.content.rstrip("\n")}] if token.content else [],
            })
            i += 1
            continue

        if token.type == "hr":
            result.append({"type": "horizontalRule"})
            i += 1
            continue

        # Skip tokens we don't handle
        i += 1

    return result


def _collect_list_items(tokens: list, start: int, close_type: str) -> tuple[list[dict], int]:
    """Collect list items until close token. Returns (items, tokens_consumed)."""
    items: list[dict] = []
    i = start
    consumed = 0
    while i < len(tokens):
        if tokens[i].type == close_type:
            break
        if tokens[i].type == "list_item_open":
            inner_tokens = []
            depth = 1
            j = i + 1
            while j < len(tokens):
                if tokens[j].type == "list_item_open":
                    depth += 1
                elif tokens[j].type == "list_item_close":
                    depth -= 1
                    if depth == 0:
                        break
                inner_tokens.append(tokens[j])
                j += 1
            inner_content = _convert_tokens(inner_tokens)
            items.append({"type": "listItem", "content": inner_content})
            consumed += (j - i + 1)
            i = j + 1
            continue
        i += 1
        consumed += 1

    return items, consumed


def _inline_to_content(token: Any) -> list[dict]:
    """Convert an inline token's children to TipTap text nodes with marks."""
    if token is None or token.children is None:
        if token and token.content:
            return [{"type": "text", "text": token.content}]
        return []

    result: list[dict] = []
    marks_stack: list[dict] = []

    for child in token.children:
        if child.type == "text":
            node: dict = {"type": "text", "text": child.content}
            if marks_stack:
                node["marks"] = list(marks_stack)
            result.append(node)

        elif child.type == "code_inline":
            node = {"type": "text", "text": child.content}
            current_marks = list(marks_stack)
            current_marks.append({"type": "code"})
            node["marks"] = current_marks
            result.append(node)

        elif child.type == "softbreak":
            node = {"type": "text", "text": "\n"}
            if marks_stack:
                node["marks"] = list(marks_stack)
            result.append(node)

        elif child.type == "strong_open":
            marks_stack.append({"type": "bold"})
        elif child.type == "strong_close":
            marks_stack = [m for m in marks_stack if m["type"] != "bold"]

        elif child.type == "em_open":
            marks_stack.append({"type": "italic"})
        elif child.type == "em_close":
            marks_stack = [m for m in marks_stack if m["type"] != "italic"]

        elif child.type == "link_open":
            href = ""
            for attr_name, attr_val in (child.attrs or {}).items():
                if attr_name == "href":
                    href = attr_val
            marks_stack.append({"type": "link", "attrs": {"href": href}})
        elif child.type == "link_close":
            marks_stack = [m for m in marks_stack if m["type"] != "link"]

    return result
