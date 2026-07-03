import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

SOURCE = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "questions.json"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def doc_lines(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    lines = []
    for paragraph in root.findall(".//w:p", NS):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", NS)).strip()
        if text:
            lines.append(text)
    return lines


def metadata(path: Path) -> tuple[str, str]:
    name = re.sub(r"^\d+_", "", path.stem)
    match = re.search(r"(第[^章]+章\s*[^（(]+)", name)
    chapter = match.group(1).strip() if match else name.split("（")[0].strip()
    if "判断" in name:
        kind = "判断题"
    elif "多选" in name:
        kind = "多选题"
    elif "B型" in name:
        kind = "B型题"
    else:
        kind = "单选题"
    return chapter, kind


def answer_section(lines: list[str]) -> tuple[list[str], str]:
    index = next(i for i, line in enumerate(lines) if line.strip() == "答案")
    return lines[1:index], " ".join(lines[index + 1:])


def parse_regular(path: Path, lines: list[str], chapter: str, kind: str) -> list[dict]:
    body, answer_text = answer_section(lines)
    blocks, current = [], None
    for line in body:
        match = re.match(r"^(\d+)\.\s*(?:\([^)]*\))?(.*)$", line)
        if match:
            if current:
                blocks.append(current)
            current = {"number": int(match.group(1)), "stem": match.group(2).strip(), "options": []}
        elif current:
            option = re.match(r"^([A-Z])\.\s*(.*)$", line)
            if option:
                current["options"].append({"key": option.group(1), "text": option.group(2).strip()})
            else:
                current["stem"] += line
    if current:
        blocks.append(current)

    answers = {}
    for number, raw in re.findall(r"(\d+)\.\s*([A-E]+|对|错)", answer_text):
        value = {"对": "A", "错": "B"}.get(raw, raw)
        answers[int(number)] = list(value)

    questions = []
    for block in blocks:
        number = block.pop("number")
        questions.append({
            "id": f"{path.stem[:2]}-{number}",
            "chapter": chapter,
            "type": kind,
            **block,
            "answer": answers.get(number, []),
        })
    return questions


def parse_b_type(path: Path, lines: list[str], chapter: str) -> list[dict]:
    body, answer_text = answer_section(lines)
    groups, group = [], None
    for line in body:
        match = re.match(r"^(\d+)\.\s*\(共用选项题\)(.*)$", line)
        if match:
            if group:
                groups.append(group)
            group = {"number": int(match.group(1)), "intro": match.group(2).strip(), "options": [], "items": []}
        elif group:
            option = re.match(r"^([A-Z])\.\s*(.*)$", line)
            item = re.match(r"^\((\d+)\)\s*(.*)$", line)
            if option:
                group["options"].append({"key": option.group(1), "text": option.group(2).strip()})
            elif item:
                group["items"].append((int(item.group(1)), item.group(2).strip()))
    if group:
        groups.append(group)

    answers = {}
    for group_no, segment in re.findall(r"(\d+)\.\s*(.*?)(?=\s+\d+\.|$)", answer_text):
        for item_no, answer in re.findall(r"\((\d+)\)\s*([A-E])", segment):
            answers[(int(group_no), int(item_no))] = [answer]

    questions = []
    for group in groups:
        for item_no, stem in group["items"]:
            questions.append({
                "id": f"{path.stem[:2]}-{group['number']}-{item_no}",
                "chapter": chapter,
                "type": "B型题",
                "stem": stem,
                "context": f"第 {group['number']} 组共用备选答案",
                "options": group["options"],
                "answer": answers.get((group["number"], item_no), []),
            })
    return questions


def main() -> None:
    questions = []
    for path in sorted(SOURCE.glob("*.docx")):
        chapter, kind = metadata(path)
        lines = doc_lines(path)
        questions.extend(parse_b_type(path, lines, chapter) if kind == "B型题" else parse_regular(path, lines, chapter, kind))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    missing = [question["id"] for question in questions if not question["answer"]]
    print(json.dumps({"questions": len(questions), "missing_answers": missing}, ensure_ascii=False))


if __name__ == "__main__":
    main()
