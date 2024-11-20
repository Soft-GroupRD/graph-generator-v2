// En tu archivo routes/usuarios.js
import { Router } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @swagger
 * /template/igwin/image:
 *   get:
 *     summary: Obtiene la imagen según los parámetros de consulta
 *     parameters:
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
router.get('/image', async (req, res) => {
  try {
    const { event, participant } = req.query;

    if (!event || !participant) {
      res.status(400).json({ error: "Faltan parámetros: template, event, participant" });
      return;
    }

    // Template paths
    const htmlFilePath = join(__dirname, `../../public/igwin`, 'index.html');
    const cssFilePath = join(__dirname, `../../public/igwin`, "estilos.css");

    const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);
    const cssExists = await fs.access(cssFilePath).then(() => true).catch(() => false);

    if (htmlExists && cssExists) {
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
      const cssContent = await fs.readFile(cssFilePath, 'utf-8');

      console.log("Fetching event information...");
      const information = await fetch(`http://20.121.40.254:1337/api/v1/external/getResultsByEventId/${event}`)
        .then((response) => {
          if (!response.ok) throw new Error("Fallo al buscar el evento");
          return response.json();
        })
        .then((data) => {
          const filterData = data.find(item => item.individual_id.toString() === participant);
          if (!filterData) throw new Error("No se encontró el participante");
          console.log("Participant information found:", filterData);
          return filterData;
        })
        .catch((error) => {
          console.error("Ocurrió un error al obtener el evento:", error);
        });

      const team_id = information?.team_id?.toString() || "1"; // Default to team_id=1 if not found
      console.log("Attempting to access team_id:", team_id);

      console.log("Fetching background image...");
      const background = await fetch('https://api4.gpesportsrd.com/fieldValues?field_id=28')
        .then((response) => {
          if (!response.ok) throw new Error("No se encontró ninguna imagen");
          return response.json();
        })
        .then((data) => {
          const findItem = data.data.find(item => item.item_id === team_id) || data.data.find(item => item.item_id === "1");
          if (!findItem) throw new Error(`No se encontró la imagen del equipo para team_id=${team_id}`);
          console.log("Background image found:", findItem);
          return findItem;
        })
        .catch((error) => {
          console.error("Ocurrió un error al obtener la imagen del equipo:", error);
        });

      console.log("Fetching brand image...");
      const brand = await fetch('https://api4.gpesportsrd.com/fieldValues?field_id=52')
        .then((response) => {
          if (!response.ok) throw new Error("No se encontró ninguna imagen");
          return response.json();
        })
        .then((data) => {
          const findItem = data.data.find(item => item.item_id === team_id) || data.data.find(item => item.item_id === "1");
          if (!findItem) throw new Error(`No se encontró la banda del equipo para team_id=${team_id}`);
          console.log("Brand image found:", findItem);
          return findItem;
        })
        .catch((error) => {
          console.error("Ocurrió un error al obtener la banda del equipo:", error);
        });

      const $ = load(htmlContent);

      const categoriName = information.Categoria.split('-')[0].trim();
      $('.siglas-categoria').text(categoriName);

      if (categoriName.length > 6) {
        $('.siglas-categoria').attr('style', 'font-size: 30px;');
        $('.parrafo-categoria').attr('style', 'font-size: 30px;');
        $('.border-blanco').attr('style', 'height: 30px;');
      }

      $('.nombre-corredor').text(`${information.first_name} ${information.last_name}`);
      $('.posicion').text(`P${information.rank}`).attr('style', 'font-size: 12em;');
      $('.location-name').text(`${information.trackshortname}`);
      $('.img-flag').attr('src', `https://gpesportsrd.com/images/templates/country_48x76/${information.trackid}.png`);
      $('.brand-image').attr('src', `https://gpesportsrd.com/${brand.value}`);
      $('.img-feed').attr('src', `https://gpesportsrd.com/${background.value}`);
      $('<style>').text(cssContent).appendTo('head');

      const modifiedHTML = $.html();
      res.send(modifiedHTML);
    } else {
      res.status(404).send({ message: "No se encontró el template" });
    }
  } catch (error) {
    console.error("Error interno:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});



/**
 * @swagger
 * /template/igwin/imageSize:
 *   get:
 *     summary: Obtiene el tamaño del template
 *     parameters:
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
 *         description: Tamaño del template obtenido con exito
 *       500:
 *         description: Error del servidor
 */
router.get('/imageSize', async (req, res) => {
  try {
    const { event, participant } = req.query

    if (!event || !participant) {
      res.status(400).json({ error: "Faltan parámetros: template, event, participant" });
      return;
    }

    // Buscamos el template
    const htmlFilePath = join(__dirname, `../../public/igwin`, 'index.html');

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

      const background = await fetch('https://api4.gpesportsrd.com/fieldValues?field_id=29')
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
      const $ = load(htmlContent);

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
export default router;