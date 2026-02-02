import sharp from 'sharp';
import fs from 'fs';

/* Esse é o script que converte imagens de alta resolução para "webp" para melhor exibição no site.
   Como usar: Modifique o input e output na linha 10 e 11 desse arquivo para os caminhos:
   1°- Local da Imagem de aLta resolução (Linha 10)
   2°- Local aonde o script irá salvar os arquivos convertidos (Linha 11)
   3°- Rode no Terminal o comando de conversão  "node .\scripts\generate-banner-images.mjs"
*/

/*Caso não esteja funcionando após o clone do projeto voce deverá realizar o seguinte comando no terminal = "pnpm add -D sharp"*/

const input = 'client/image_teste/Banner_3.jpg';
const outputDir = 'client/public/banner_3';

fs.mkdirSync(outputDir, { recursive: true });

const formats = [
  { name: 'mobile', width: 768 },
  /*{ name: 'desktop', width: 1440 },
  { name: 'desktop@2x', width: 2560 },*/
];

for (const f of formats) {
  await sharp(input)
    .resize({ width: f.width })
    .toFormat('webp', { quality: 80 })
    .toFile(`${outputDir}/${f.name}.webp`);
}

console.log('Imagem convertida para modelos Adequados de exibição no site.');
