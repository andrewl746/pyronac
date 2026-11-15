// "Download base list (PDF)": a PDF file made in the browser with jsPDF, saved straight to the
// user's downloads. A4 portrait: title, date and sources, a picture of the map with the base
// numbers, the sentences, the full table with coordinates, and the limits. jsPDF loads only when
// the button is pressed, so the app's first load stays the same size.
import { formatCount, formatDate } from "../../lib/format";
import { mapPicture } from "./picture";
import { coveredSentence, limitsNote, peopleSentence, percentOne, selftestSentence, SOURCES_LINE } from "./sentences";
import { useBases } from "./store";
import type { BaseSites, ReachResult } from "./types";

const PAGE_MARGIN = 14; // mm
const MAP_MAX_HEIGHT = 120; // mm
const MAP_MAX_PIXELS = 1800; // the picture's longest side in the file, to keep it small

// jsPDF's built-in fonts cover Latin-1 only. Letters outside it lose their accents, so a name such
// as "Behchokǫ̀" reads "Behchoko" rather than turning into stray symbols. é, è and ç stay.
function latin1(text: string): string {
  return [...text.normalize("NFC")]
    .map((c) => (c.charCodeAt(0) <= 255 ? c : c.normalize("NFD").replace(/[̀-̨ͯ]/g, "")))
    .join("")
    .replace(/[^\u0000-ÿ–—’]/g, "");
}

// The map picture as a JPEG no wider than MAP_MAX_PIXELS: much smaller than the full-size PNG.
function asJpeg(dataUrl: string): Promise<{ url: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAP_MAX_PIXELS / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) return resolve(null);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ url: canvas.toDataURL("image/jpeg", 0.88), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

export async function downloadBaseList(data: BaseSites, result: ReachResult, count: number): Promise<void> {
  const sites = result.sites.slice(0, count);
  const km = result.reach_km;
  const { map } = useBases.getState();
  const picture = map ? await mapPicture(map, sites, km) : null;
  const jpeg = picture ? await asJpeg(picture) : null;

  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN + 4;

  // A block of text that wraps to the page width; returns nothing, moves y down.
  function paragraph(text: string, size: number, color: [number, number, number] = [20, 20, 20], gap = 2.5): void {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(latin1(text), textWidth) as string[];
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * size * 0.42 + gap;
  }

  const today = new Date().toISOString().slice(0, 10);
  doc.setFont("helvetica", "bold");
  paragraph("Pyronac: candidate fire base sites in Canada", 16, [20, 20, 20], 3);
  doc.setFont("helvetica", "normal");
  paragraph(
    `${count === 1 ? "1 base" : `${count} bases`} with a ${km} km reach. Made ${formatDate(today)}. ` +
      `Sites worked out from the harmonized record of ${data.years[0]} to ${data.years[1]}.`,
    10,
  );
  paragraph(SOURCES_LINE, 9, [100, 100, 100], 4);

  if (jpeg) {
    let width = textWidth;
    let height = (jpeg.height / jpeg.width) * width;
    if (height > MAP_MAX_HEIGHT) {
      height = MAP_MAX_HEIGHT;
      width = (jpeg.width / jpeg.height) * height;
    }
    doc.addImage(jpeg.url, "JPEG", PAGE_MARGIN + (textWidth - width) / 2, y, width, height);
    y += height + 5;
  } else {
    paragraph("The map picture could not be taken in this browser. The coordinates are in the table below.", 9, [100, 100, 100], 4);
  }

  paragraph(`${coveredSentence(data, result, count)} ${selftestSentence(data, result, count)} ${peopleSentence(result, count)}`, 10, [20, 20, 20], 4);

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["#", "Biggest town", "Lat", "Lon", "Adds", "People", "Typical year", "2003–11 raw / harm."]],
    body: sites.map((site) => [
      String(site.rank),
      site.town ? latin1(`${site.town}, ${site.town_km} km`) : "none within reach",
      site.lat.toFixed(2),
      site.lon.toFixed(2),
      percentOne(site.adds),
      formatCount(site.people),
      formatCount(Math.round(site.typical_year)),
      `${formatCount(Math.round(site.early_raw))} / ${formatCount(Math.round(site.early_harmonized))}`,
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.2, textColor: [20, 20, 20] },
    headStyles: { fillColor: [235, 235, 235], textColor: [20, 20, 20], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    theme: "grid",
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
  y = finalY + 6;
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = PAGE_MARGIN + 4;
  }
  paragraph(limitsNote(data), 8.5, [100, 100, 100]);

  doc.save(`pyronac-fire-bases-${count}-sites-${km}km.pdf`);
}
