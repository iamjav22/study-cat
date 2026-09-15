/* =========================================================
   PIXEL CAT — sprite data + renderer
   Each sprite is a grid of small numbers. 0 = transparent.
   To design your own pose: edit the grid below (each row must
   have the same number of values) and reload the page.
   ========================================================= */

const CAT_PALETTE = {
  1: '#2B2420', // outline
  2: '#F5F0E0', // fur
  3: '#E6A0A6', // pink (ears/cheeks)
  4: '#1E1914', // eyes
};

const CAT_SPRITES = {
  nap: [
    [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0],
    [0,1,2,1,0,0,0,0,0,1,2,1,0,0,0,0],
    [0,1,2,2,1,0,0,0,1,2,2,1,0,0,0,0],
    [0,0,1,2,2,1,1,1,1,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,1,2,2,3,2,4,2,3,2,1,0,0,0,0],
    [0,0,1,2,4,2,2,2,4,2,2,1,0,0,0,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1],
    [0,1,2,2,2,2,2,2,2,2,2,2,1,2,2,1],
    [0,0,1,1,1,1,1,1,1,1,1,1,0,1,2,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  ],
  alert: [
    [0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0],
    [0,1,2,1,0,0,0,0,0,1,2,1,0,0,0,0],
    [0,1,2,1,0,0,0,0,0,1,2,1,0,0,0,0],
    [0,1,2,2,1,0,0,0,1,2,2,1,0,0,0,0],
    [0,0,1,2,2,1,1,1,1,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,1,2,2,3,2,4,2,3,2,1,0,0,0,0],
    [0,0,1,2,4,2,2,2,4,2,2,1,0,0,0,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1],
    [0,1,2,2,2,2,2,2,2,2,2,2,1,2,2,1],
    [0,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0],
  ],
  stretch: [
    [0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,2,2,1,0,0,0,0],
    [1,1,0,0,0,0,0,0,0,0,1,2,2,1,0,0,0,0],
    [1,2,1,0,0,0,0,0,0,1,2,2,2,1,0,0,0,0],
    [0,1,2,1,0,0,0,0,1,2,4,2,4,1,0,0,0,0],
    [0,0,1,2,1,0,0,0,1,2,2,2,2,1,0,0,0,0],
    [0,0,0,1,2,1,1,1,1,2,3,2,3,1,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,1,2,2,1,1,2,2,1,1,0,0,0,0,0,0,0],
    [0,0,1,2,1,0,0,1,2,1,0,0,0,0,0,0,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
  ],
};

/**
 * Draws a sprite grid onto a canvas, crisp and unblurred at any size.
 * canvasEl: the <canvas> element
 * spriteName: 'nap' | 'alert'
 * pixelSize: how many real pixels each sprite-pixel should take up
 */
function drawCatSprite(canvasEl, spriteName, pixelSize = 18){
  const grid = CAT_SPRITES[spriteName];
  if(!canvasEl || !grid) return;
  const rows = grid.length;
  const cols = grid[0].length;

  canvasEl.width = cols * pixelSize;
  canvasEl.height = rows * pixelSize;

  const ctx = canvasEl.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  for(let y = 0; y < rows; y++){
    for(let x = 0; x < cols; x++){
      const v = grid[y][x];
      if(v === 0) continue;
      ctx.fillStyle = CAT_PALETTE[v] || '#000';
      ctx.fillRect(x*pixelSize, y*pixelSize, pixelSize, pixelSize);
    }
  }
}
