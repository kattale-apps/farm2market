Export instructions

1) To create PDF from the Markdown file:

```bash
# Using pandoc (if installed):
# Install: https://pandoc.org/installing.html
pandoc ARCHITECTURE_SUBMISSION.md -o ARCHITECTURE_SUBMISSION.pdf --standalone
```

2) To export the draw.io file to PNG or PDF:
- Open `architecture_diagram.drawio` in https://app.diagrams.net
- File → Export as → PNG (or PDF)

3) Mermaid diagrams:
- Use the `.mmd` files in `diagrams/` with any Mermaid renderer or paste into https://mermaid.live to export PNG/PDF.

4) Quick local render of Mermaid to PNG using `mmdc` (Mermaid CLI):

```bash
# install mermaid-cli globally
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagrams/architecture.mmd -o diagrams/architecture.png
mmdc -i diagrams/auth-flow.mmd -o diagrams/auth-flow.png
mmdc -i diagrams/data-flow.mmd -o diagrams/data-flow.png
```
