// En tu archivo routes/usuarios.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const router = express.Router();
const fetch = require('node-fetch');

/**
 * @swagger
 * /images/{template}/{event}/{participant}:
 *   get:
 *     summary: Obtiene la imagen que coincide con los parámetros proporcionados
 *     parameters:
 *       - name: template
 *         in: path
 *         required: true
 *         type: string
 *         description: El valor del parámetro 'template'
 *       - name: event
 *         in: path
 *         required: true
 *         type: string
 *         description: El valor del parámetro 'event'
 *       - name: participant
 *         in: path
 *         required: true
 *         type: string
 *         description: El valor del parámetro 'participant'
 *     responses:
 *       200:
 *         description: Imagen obtenida exitosamente
 *       500:
 *         description: Error del servidor
 */
router.get('/:template/:event/:participant', (req, res) => {
  const { template, event, participant } = req.params; // Usa req.params para obtener los parámetros de la ruta

  // Lógica para obtener la imagen basada en los parámetros

  res.status(200).send(`Obteniendo imagen para: ${template}, ${event}, ${participant}`);
});


// Reemplaza las rutas de las fuentes en el contenido CSS
function replaceFontPaths(cssContent, newFontPath) {
  // Utiliza una expresión regular para encontrar y reemplazar las rutas de las fuentes
  return cssContent.replace(/url\(['"]?(.*?)['"]?\)/g, (match, fontUrl) => {
    // Reemplaza la ruta de la fuente con la nueva ruta
    return `url(${newFontPath}${fontUrl})`;
  });
}


/**
 * @swagger
 * /images/file:
 *   get:
 *     summary: Obtiene la imagen según los parámetros de consulta
 *     parameters:
 *       - name: template
 *         in: query
 *         type: string
 *         description: El valor del parámetro 'template'
 *       - name: event
 *         in: query
 *         type: string
 *         description: El valor del parámetro 'event'
 *       - name: participant
 *         in: query
 *         type: string
 *         description: El valor del parámetro 'participant'
 *     responses:
 *       200:
 *         description: Imagen obtenida exitosamente
 *       500:
 *         description: Error del servidor
 */
router.get('/', async (req, res) => {
  try {

    const { file } = req.query

    if (!file.includes("-") || !file.includes(".png")) {
      throw new Error("Sintaxis no valida")
    }

    const [template, event, participant] = file.replace(".png", "").split("-")

    if (!template || !event || !participant) {
      res.status(400).json({ error: "Faltan parámetros: template, event, participant" });
      return;
    }

    const fileName = `${template}-${event}-${participant}.png`;
    const filePath = path.join(__dirname, '../images/igImages', fileName);

    // Verifica si el archivo PNG ya existe
    const pngExists = await fs.access(filePath).then(() => true).catch(() => false);

    if (pngExists) {
      // Si el archivo PNG existe, enviarlo como respuesta
      res.sendFile(filePath);
    } else {
      // Buscamos el template
      const htmlFilePath = path.join(__dirname, `../templates/${template}`, 'index.html');
      const cssFilePath = path.join(__dirname, `../public/${template}`, "estilos.css");

      // Verifica si el html y el css existen
      const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);
      const cssExists = await fs.access(cssFilePath).then(() => true).catch(() => false);

      if (htmlExists && cssExists) {

        const { width, height } = await fetch('http://localhost:3500/templates/imageSize?template=igwin&event=1289&participant=387')
          .then((response) => {

            if (!response.ok) {
              throw new Error("Falló la consulta")
            }
            return response.json();
          })
          .then((data) => {
            return data
          })
          .catch((error) => {
            console.error(error)
          })

        const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-features=FontsOnDemand'], });
        const page = await browser.newPage();

        // URL de tu página HTML generada dinámicamente
        const dynamicPageURL = `http://localhost:3500/templates/image?template=${template}&event=${event}&participant=${participant}`;

        await page.goto(dynamicPageURL, { waitUntil: 'networkidle0' });


        // Verifica si las conversiones son válidas
        if (!isNaN(width) && !isNaN(height)) {
          // Si los valores son números válidos los seteamos
          await page.setViewport({ width: width, height: height });
        } else {
          console.log('Los valores de ancho y alto no son números válidos.');
        }

        // Captura una captura de pantalla y conviértela en formato base64
        // const screenshot = await page.screenshot({ encoding: 'base64' });
        await page.screenshot({ path: filePath, type: 'png' });

        await browser.close();

        // Devuelve la captura de pantalla como respuesta
        /*
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': screenshot.length
        });
        res.end(Buffer.from(screenshot, 'base64'));
        */
        res.sendFile(filePath);


        //////////////////////////////
        /////// Antigua logica ///////
        //////////////////////////////

        /*
        // Lee el contenido de los archivos HTML y CSS de manera asíncrona
        const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
        const cssContent = await fs.readFile(cssFilePath, 'utf-8')

        // Modifica las rutas de las fuentes en el CSS
        const newFontPath = '/fonts'; // Cambia esta ruta a la que necesites
        const modifiedCSS = replaceFontPaths(cssContent, newFontPath);


        const information = await fetch(`http://20.121.40.254:1337/api/v1/external/getResultsByEventId/${event}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error("Fallo al buscar el evento");
            }
            return response.json();
          })
          .then((data) => {

            const filterData = data.find(item => item.individual_id.toString() === participant);

            if (!filterData) {
              throw new Error("No se encontró el participante");
            }

            return filterData
          })
          .catch((error) => {
            console.error("Ocurrió un error:", error);
            // Manejo de errores
          });

        const background = await fetch('https://api4.gpesportsrd.com/fieldValues?field_id=28')
          .then((response) => {
            if (!response.ok) {
              throw new Error("No se encontró ninguna imagen");
            }
            return response.json();
          })
          .then((data) => {
            const findItem = data.data.find(item => item.item_id === information.team_id.toString());

            if (!findItem) {
              throw new Error("No se encontró la imagen del equipo");
            }

            return findItem
          })
          .catch((error) => {
            console.error("Ocurrió un error:", error);
            // Manejo de errores
          });

        const brand = await fetch('https://api4.gpesportsrd.com/fieldValues?field_id=52')
          .then((response) => {

            if (!response.ok) {
              throw new Error("No se encontró ninguna imagen")
            }

            return response.json();
          })
          .then((data) => {
            const findItem = data.data.find(item => item.item_id === information.team_id.toString())

            if (!findItem) {
              throw new Error("No se encontró la banda del equipo");
            }

            return findItem
          }).catch((error) => {
            console.error("Ocurrió un error:", error);
            // Manejo de errores
          })


        // Carga el HTML en Cheerio
        const $ = cheerio.load(htmlContent);

        // Manipula el HTML como lo harías con jQuery
        $('.siglas-categoria').text(information.Categoria.split('-')[0].trim());

        $('.nombre-corredor')
          .text(`${information.first_name} ${information.last_name}`)
          .css({ 'font-size': information.first_name.length + information.last_name.length > 14 ? '8em' : '10em' });

        $('.posicion').text(`P${information.rank}`);

        $('.location-name').text(`${information.trackname}`);

        $('.img-flag').attr('src', `https://gpesportsrd.com/images/templates/country_48x76/${information.trackid}.png`);

        $('.img-corredor').remove();

        $('.brand-image').attr('src', `https://gpesportsrd.com/${brand.value}`);

        $('.img-feed').attr('src', `https://gpesportsrd.com/${background.value}`);

        // Selecciona el background
        const $img = $('.img-feed');

        // Obtener el valor de los atributos width y height
        const width = $img.attr('width');
        const height = $img.attr('height');

        // Convierte las cadenas en números
        const widthNumber = parseInt(width, 10); // Convierte a número base 10
        const heightNumber = parseInt(height, 10); // Convierte a número base 10

        // Agregamos el estilo
        // $('<link>').attr('rel', `stylesheet`).attr('href', cssFilePath);

        // $('<style>').text(cssContent).appendTo('head');

        $('<style>').text(modifiedCSS).appendTo('head');

        // Imprime el HTML modificado
        const modifiedHTML = $.html();

        // Inicializa Puppeteer
        const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-features=FontsOnDemand'], });
        const page = await browser.newPage();


        // Verifica si las conversiones son válidas
        if (!isNaN(widthNumber) && !isNaN(heightNumber)) {
          // Si los valores son números válidos los seteamos
          await page.setViewport({ width: widthNumber, height: heightNumber });
        } else {
          console.log('Los valores de ancho y alto no son números válidos.');
        }

        // Después de crear la página con page.setContent()
        await page.addStyleTag({ path: cssFilePath }); // Asegúrate de que 'cssFilePath' sea la ruta al archivo CSS


        // Configura el contenido de la página con el HTML modificado
        await page.setContent(modifiedHTML);

        // Espera a que todas las fuentes estén cargadas en la página
        await page.waitForFunction(() => {
          const fonts = document.fonts;
          return Array.from(fonts).every(font => font.status === 'loaded');
        });

        // Captura una captura de pantalla de la página con los estilos CSS aplicados
        await page.screenshot({ path: filePath, type: 'png' });

        // Cierra el navegador de Puppeteer
        await browser.close();

        // Envía el archivo HTML (Es para validar que se cree correctamente)
        // res.send(modifiedHTML);

        // res.send(htmlContent2);

        // Envía el archivo PNG generado como respuesta
        res.sendFile(filePath);
        */
      } else {
        res.status(404).send({ message: "No se encontró el template" })
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// Exporta el enrutador para su uso en otro lugar
module.exports = router;