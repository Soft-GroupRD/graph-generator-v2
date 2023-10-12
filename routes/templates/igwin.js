// En tu archivo routes/usuarios.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');
const router = express.Router();
const fetch = require('node-fetch');

/**
 * @swagger
 * /templates/image:
 *   get:
 *     summary: Obtiene la imagen que coincide con los parámetros proporcionados
 *     responses:
 *       200:
 *         description: Imagen obtenida exitosamente
 *       500:
 *         description: Error del servidor
 */
router.get('/image', async (req, res) => {
  try {
    const { template, event, participant } = req.query

    if (!template || !event || !participant) {
      res.status(400).json({ error: "Faltan parámetros: template, event, participant" });
      return;
    }

    // Buscamos el template
    const htmlFilePath = path.join(__dirname, `../../public/${template}`, 'index.html');
    const cssFilePath = path.join(__dirname, `../../public/${template}`, "estilos.css");

    // Verifica si el html y el css existen
    const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);
    const cssExists = await fs.access(cssFilePath).then(() => true).catch(() => false);

    if (htmlExists && cssExists) {
      // Lee el contenido de los archivos HTML y CSS de manera asíncrona
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
      const cssContent = await fs.readFile(cssFilePath, 'utf-8')


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

          const team_id = information?.team_id?.toString() || "11"

          const findItem = data.data.find(item => item.item_id === team_id);

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

          const team_id = information?.team_id?.toString() || "11"

          const findItem = data.data.find(item => item.item_id === team_id)

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

      const categoriName = information.Categoria.split('-')[0].trim()

      // Manipula el HTML como lo harías con jQuery
      $('.siglas-categoria').text(categoriName);

      // Si la categoria es un nombre muy largo
      if (categoriName.length > 6) {
        $('.siglas-categoria').attr('style', 'font-size: 30px;');
        $('.parrafo-categoria').attr('style', 'font-size: 30px;');
        $('.border-blanco').attr('style', 'height: 30px;');
      } else if (categoriName.length > 8) {
        $('.siglas-categoria').attr('style', 'font-size: 25px;');
        $('.parrafo-categoria').attr('style', 'font-size: 25px;');
        $('.border-blanco').attr('style', 'height: 25px;');
      } else if (categoriName.length > 14) {
        $('.siglas-categoria').attr('style', 'font-size: 20PX;');
        $('.parrafo-categoria').attr('style', 'font-size: 20PX;');
        $('.border-blanco').attr('style', 'height: 20px;');
      }

      $('.nombre-corredor')
        .text(`${information.first_name} ${information.last_name}`)
        .css({ 'font-size': information.first_name.length + information.last_name.length > 14 ? '8em' : '10em' });

      $('.posicion').text(`P${information.rank}`).attr('style', 'font-size: 12em;');

      $('.location-name').text(`${information.trackname}`);

      $('.img-flag').attr('src', `https://gpesportsrd.com/images/templates/country_48x76/${information.trackid}.png`);

      $('.img-corredor').remove();

      $('.brand-image').attr('src', `https://gpesportsrd.com/${brand.value}`);

      $('.img-feed').attr('src', `https://gpesportsrd.com/${background.value}`);

      $('<style>').text(cssContent).appendTo('head');

      // Imprime el HTML modificado
      const modifiedHTML = $.html();

      res.send(modifiedHTML);
    } else {
      res.status(404).send({ message: "No se encontró el template" })
    }
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});



/**
 * @swagger
 * /templates/imageSize:
 *   get:
 *     summary: Obtiene la imagen que coincide con los parámetros proporcionados
 *     responses:
 *       200:
 *         description: Imagen obtenida exitosamente
 *       500:
 *         description: Error del servidor
 */
router.get('/imageSize', async (req, res) => {
  try {
    const { template, event, participant } = req.query

    if (!template || !event || !participant) {
      res.status(400).json({ error: "Faltan parámetros: template, event, participant" });
      return;
    }

    // Buscamos el template
    const htmlFilePath = path.join(__dirname, `../../public/${template}`, 'index.html');

    // Verifica si el html y el css existen
    const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);

    if (htmlExists) {
      // Lee el contenido de los archivos HTML y CSS de manera asíncrona
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')


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

          const team_id = information?.team_id?.toString() || "11"

          const findItem = data.data.find(item => item.item_id === team_id);

          if (!findItem) {
            throw new Error("No se encontró la imagen del equipo");
          }

          return findItem
        })
        .catch((error) => {
          console.error("Ocurrió un error:", error);
          // Manejo de errores
        });


      // Carga el HTML en Cheerio
      const $ = cheerio.load(htmlContent);

      $('.img-feed').attr('src', `https://gpesportsrd.com/${background.value}`);

      // Selecciona el background
      const $img = $('.img-feed');

      // Obtener el valor de los atributos width y height
      const width = $img.attr('width');
      const height = $img.attr('height');

      // Convierte las cadenas en números
      const widthNumber = parseInt(width, 10); // Convierte a número base 10
      const heightNumber = parseInt(height, 10); // Convierte a número base 10

      // Verifica si las conversiones son válidas
      if (!isNaN(widthNumber) && !isNaN(heightNumber)) {
        // Si los valores son números válidos los seteamos
        res.json({ width: widthNumber, height: heightNumber });
      } else {
        res.status(404).send({ message: "No se encontró el tamaño" })
      }
    } else {
      res.status(404).send({ message: "No se encontró el template" })
    }
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// Exporta el enrutador para su uso en otro lugar
module.exports = router;