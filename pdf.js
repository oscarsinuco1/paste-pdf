// Minimal PDF writer: one JPEG image per page. No dependencies.
const enc = new TextEncoder();

// pages: [{ jpeg: Uint8Array, imgW, imgH, pageW, pageH, x, y, w, h }] (units: pt)
export function buildPdf(pages) {
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const b = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(b);
    length += b.length;
  };
  const startObj = (n) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };
  const f = (n) => +n.toFixed(2);

  // Object ids: 1 catalog, 2 pages, 3 info, then per page i: image 4+3i, content 5+3i, page 6+3i
  const pageIds = pages.map((_, i) => 6 + i * 3);

  push("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  startObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObj(2);
  push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] >>\nendobj\n`);
  startObj(3);
  push("<< /Producer (PDF por Pantalla) >>\nendobj\n");

  pages.forEach((p, i) => {
    const imgId = 4 + i * 3;
    const contId = 5 + i * 3;
    const pageId = 6 + i * 3;
    startObj(imgId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${p.imgW} /Height ${p.imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`
    );
    push(p.jpeg);
    push("\nendstream\nendobj\n");
    const content = `q ${f(p.w)} 0 0 ${f(p.h)} ${f(p.x)} ${f(p.y)} cm /Im0 Do Q`;
    startObj(contId);
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    startObj(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(p.pageW)} ${f(p.pageH)}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contId} 0 R >>\nendobj\n`
    );
  });

  const total = 4 + pages.length * 3;
  const xref = length;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) x += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}
