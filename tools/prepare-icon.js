const sharp = require('sharp');
const argv = require('minimist')(process.argv.slice(2));

const input = argv.in || 'assets/myphoto.jpg';
const out = argv.out || 'assets/icon-1024.png';
const size = parseInt(argv.size || '1024', 10);
const bg = argv.bg || '#00000';
const fit = argv.fit || 'cover'; // cover/contain
const scale = Math.max(0.5, Math.min(1.0, parseFloat(argv.scale || '0.80'))); // 0.5~1.0

(async () => {
  try {
    const target = Math.round(size * scale);
    // 로고(원본)를 scale 비율로 리사이즈
    const logo = await sharp(input)
      .resize(target, target, { fit: fit, position: 'centre', background: bg })
      .png()
      .toBuffer();

    // 1024x1024 캔버스(배경색 지정) 위에 중앙 합성
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: bg,
      },
    })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toFile(out);

    console.log(`[OK] Saved: ${out} (scale=${scale}, bg=${bg})`);
  } catch (e) {
    console.error('[ERROR]', e);
    process.exit(1);
  }
})();