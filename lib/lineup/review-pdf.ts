import sharp from "sharp";
import {PDFDocument, StandardFonts, rgb} from "pdf-lib";

/** Letter pages tiled without rescaling. PNG pixels use the supplier canvas DPI. */
export async function actualSizeReviewPdf(artwork: Buffer, dpi: number) {
  if (!Number.isFinite(dpi) || dpi < 72 || dpi > 1200) throw new Error("Invalid print resolution");
  const {data,info} = await sharp(artwork,{limitInputPixels:40_000_000}).trim().png().toBuffer({resolveWithObject:true});
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const tileWidth = Math.floor(7*dpi), tileHeight = Math.floor(8*dpi);
  const columns = Math.ceil(info.width/tileWidth), rows = Math.ceil(info.height/tileHeight);
  if (columns*rows > 36) throw new Error("Print guide exceeds supported size");
  for(let row=0;row<rows;row++) for(let col=0;col<columns;col++){
    const left=col*tileWidth,top=row*tileHeight;
    const width=Math.min(tileWidth,info.width-left),height=Math.min(tileHeight,info.height-top);
    const tile=await sharp(data).extract({left,top,width,height}).png().toBuffer();
    const image=await pdf.embedPng(tile);
    const page=pdf.addPage([612,792]);
    page.drawText("VeryMerch - actual-size artwork review",{x:36,y:760,size:14,font});
    page.drawText("Print at 100% / Actual size. Disable Fit to page.",{x:36,y:739,size:11,font});
    page.drawText(`Tile ${row+1},${col+1} of ${rows} rows x ${columns} columns. Join adjacent edges.`,{x:36,y:722,size:10,font});
    // Light gray inspection background makes white artwork visible; not a production file.
    page.drawRectangle({x:36,y:690-height/dpi*72,width:width/dpi*72,height:height/dpi*72,color:rgb(.92,.92,.92)});
    page.drawImage(image,{x:36,y:690-height/dpi*72,width:width/dpi*72,height:height/dpi*72});
    page.drawLine({start:{x:36,y: 70},end:{x:108,y: 70},thickness:1});
    page.drawText("Measure this line: exactly 1 inch (25.4 mm).",{x:120,y:67,size:10,font});
    page.drawText("Paper checks size and readability, not fabric texture or final print color.",{x:36,y:45,size:10,font});
    page.drawText("Gray background is for inspection only. This is not the fulfillment file.",{x:36,y:29,size:10,font});
  }
  return pdf.save();
}

