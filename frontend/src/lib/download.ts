// Save an on-screen SVG as a PNG image. MASTERSPEC.md section 8, "Downloads".

// What an SVG drawn as an image loses, because it can no longer see the page's CSS.
const STYLE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-opacity",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
];

const SCALE = 2; // twice the on-screen size, so it stays sharp
const PADDING = 16;
const CAPTION_HEIGHT = 22;

// Copy the colours and fonts the browser worked out (including every var(--...)) onto the copy.
function inlineStyles(source: Element, copy: Element) {
  const computed = getComputedStyle(source);
  const style = (copy as SVGElement).style;
  for (const property of STYLE_PROPERTIES) style.setProperty(property, computed.getPropertyValue(property));
  for (let i = 0; i < source.children.length; i++) inlineStyles(source.children[i], copy.children[i]);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The chart could not be drawn as an image."));
    image.src = url;
  });
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Serialises the SVG, draws it on a canvas at twice the size with the --panel background, and saves it.
// The optional caption is written above the chart, so the image explains itself when shared.
export async function downloadSvgAsPng(svgElement: SVGSVGElement, filename: string, caption?: string): Promise<void> {
  const { width, height } = svgElement.getBoundingClientRect();
  const copy = svgElement.cloneNode(true) as SVGSVGElement;
  inlineStyles(svgElement, copy);
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  if (!copy.getAttribute("viewBox")) copy.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const root = getComputedStyle(document.documentElement);
  const top = PADDING + (caption ? CAPTION_HEIGHT : 0);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((width + 2 * PADDING) * SCALE);
  canvas.height = Math.round((height + top + PADDING) * SCALE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot make the image.");
  context.scale(SCALE, SCALE);
  context.fillStyle = root.getPropertyValue("--panel").trim() || "#14181d";
  context.fillRect(0, 0, width + 2 * PADDING, height + top + PADDING);
  if (caption) {
    context.fillStyle = root.getPropertyValue("--text").trim() || "#e8eaed";
    context.font = `600 13px ${getComputedStyle(document.body).fontFamily}`;
    context.textBaseline = "top";
    context.fillText(caption, PADDING, PADDING, width);
  }

  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    context.drawImage(await loadImage(svgUrl), PADDING, top, width, height);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("This browser cannot make the image.");
  save(blob, filename);
}
