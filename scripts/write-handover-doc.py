from pathlib import Path
path = Path(r"docs/handover/RecruitFlow_IT_Handover_Documentation_and_Speaker_Guide.md")
path.write_text(Path(r"scripts/_handover_doc_body.md").read_text(encoding="utf-8"), encoding="utf-8")
print("copied", path, path.stat().st_size)
