import re


def references_named_document(question: str) -> bool:
    if re.search(r"\S+\.(?:pdf|docx|pptx|txt)\b", question, flags=re.IGNORECASE):
        return True

    # Accept spoken filenames such as "hello_595 PDF", but not "a PDF" or "to PDF".
    generic_prefixes = {"a", "an", "the", "my", "our", "this", "these", "that", "those", "any", "is", "are", "to", "as"}
    for match in re.finditer(r"\b([\w.-]+)\s+(?:pdf|docx|pptx|txt)\b", question, flags=re.IGNORECASE):
        name = match.group(1)
        explicit_reference = re.search(
            r"\b(?:the|my|our|this|that|summarize|summarise|read)\s+$",
            question[:match.start()], flags=re.IGNORECASE,
        )
        filename_shape = re.search(r"[\d_.-]", name)
        if name.casefold() not in generic_prefixes and (explicit_reference or filename_shape):
            return True
    return False


def matches_document_filename(question: str, filename: str) -> bool:
    stem, separator, extension = filename.rpartition(".")
    if not separator:
        return False

    # Preserve filename boundaries while allowing either a dot or spoken extension.
    pattern = r"(?<![\w.-])" + re.escape(stem) + r"(?:\s*\.\s*|\s+)" + re.escape(extension) + r"(?![\w-]|\.\w)"
    return re.search(pattern, question, flags=re.IGNORECASE) is not None


def references_course_document(question: str) -> bool:
    if references_named_document(question):
        return True

    document_words = r"(?:documents?|files?|materials?|notes?|pdfs?|slides?)"
    mentions_upload = re.search(r"\b(?:uploaded|attached)\b", question, flags=re.IGNORECASE)
    mentions_document = re.search(rf"\b{document_words}\b", question, flags=re.IGNORECASE)
    specific_document = re.search(
        rf"\b(?:my|our|this|these|that|those)\s+(?:course\s+)?{document_words}\b",
        question, flags=re.IGNORECASE,
    )
    return bool((mentions_upload and mentions_document) or specific_document)
