const escapePdfText = (value) =>
  String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/\r?\n/g, " ");

const wrapText = (text, maxChars = 88) => {
  const tokens = String(text || "").split(/\s+/).filter(Boolean);
  if (!tokens.length) return [""];

  const lines = [];
  let current = "";

  for (const token of tokens) {
    const candidate = current ? `${current} ${token}` : token;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = token;
  }

  if (current) lines.push(current);
  return lines;
};

const buildContentStream = (lines) => {
  const streamLines = ["BT", "/F1 10 Tf", "50 760 Td"];
  let isFirst = true;

  for (const line of lines) {
    const escaped = escapePdfText(line);
    if (isFirst) {
      streamLines.push(`(${escaped}) Tj`);
      isFirst = false;
    } else {
      streamLines.push("0 -14 Td");
      streamLines.push(`(${escaped}) Tj`);
    }
  }

  streamLines.push("ET");
  return streamLines.join("\n");
};

const splitPages = (lines, linesPerPage = 48) => {
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  return pages.length ? pages : [[""]];
};

export const buildTranscriptPdfBuffer = ({
  title = "Encounter Transcript",
  lines = [],
} = {}) => {
  const normalized = [title, "", ...lines.flatMap((line) => wrapText(line, 88))];
  const pages = splitPages(normalized, 48);

  let nextId = 1;
  const catalogId = nextId++;
  const pagesId = nextId++;

  const pageIds = pages.map(() => nextId++);
  const contentIds = pages.map(() => nextId++);
  const fontId = nextId++;

  const objects = [];
  const addObject = (id, body) => {
    objects.push({ id, body });
  };

  addObject(
    catalogId,
    `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  );

  addObject(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );

  for (let i = 0; i < pages.length; i += 1) {
    addObject(
      pageIds[i],
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`
    );

    const stream = buildContentStream(pages[i]);
    addObject(
      contentIds[i],
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`
    );
  }

  addObject(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  objects.sort((a, b) => a.id - b.id);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const obj of objects) {
    offsets[obj.id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= objects.length; id += 1) {
    const offset = String(offsets[id] || 0).padStart(10, "0");
    pdf += `${offset} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
};
