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
 * /template/seasonpoints/image:
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
    const { event } = req.query

    if (!event) {
      res.status(400).json({ error: "Faltan parámetros: template, event" });
      return;
    }

    // Buscamos el template
    const htmlFilePath = join(__dirname, `../../public/seasonpoints`, 'index.html');
    const cssFilePath = join(__dirname, `../../public/seasonpoints/css`, "estilos.css");

    // Verifica si el html y el css existen
    const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);
    const cssExists = await fs.access(cssFilePath).then(() => true).catch(() => false);

    if (htmlExists && cssExists) {
      // Lee el contenido de los archivos HTML y CSS de manera asíncrona
      const htmlContent = await fs.readFile(htmlFilePath, 'utf-8')
      const cssContent = await fs.readFile(cssFilePath, 'utf-8')

      const information = await fetch(`https://api4.gpesportsrd.com/season_status/pilot_points?project_id=${event}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Fallo al buscar el evento");
          }
          return response.json();
        })
        .then(async (data) => {

          if (!data) {
            throw new Error("No se encontraron participantes");
          }

          const filterData = data.sort((a, b) => b.total_points - a.total_points).slice(0, 10);

          if (!filterData) {
            throw new Error("No se encontraron participantes");
          }

          const moreInformation = await Promise.all(filterData.map(async (driver) => {
            try {
              const findTeam = await fetch(`https://api4.gpesportsrd.com/fieldValues?field_id=${54}&item_id=${driver.team_id}`);

              if (!findTeam.ok) {
                throw new Error("Fallo al buscar la información del team");
              }

              const data = await findTeam.json();

              if (data.data.length === 0) {
                const defaultTeam = await fetch(`https://api4.gpesportsrd.com/fieldValues?field_id=${54}&item_id=${32}`);
                const dataDefaultTeam = await defaultTeam.json();
                data.data = dataDefaultTeam.data
              }

              return {
                ...driver,
                teamData: data.data[0]
              };
            } catch (error) {
              console.error("Ocurrió un error:", error);
              return null;
            }
          }));


          if (!moreInformation) {
            throw new Error("No se encontró más informacion");
          }

          return moreInformation
        })
        .catch((error) => {
          console.error("Ocurrió un error:", error);
          // Manejo de errores
        });

      // Carga el HTML en Cheerio
      const $ = load(htmlContent);

      const individualInformation = information[0]

      let sponsorsList = []

      if (individualInformation?.project_sponsors) {
        const sponsorsListJson = JSON.parse(individualInformation.project_sponsors);
        if(sponsorsListJson.length > 0) {
          sponsorsList = sponsorsListJson
        }
      }

      const sponsors = await fetch(`https://api4.gpesportsrd.com/fieldValues?field_id=55`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Fallo al buscar los sponsors");
          }
          return response.json();
        })
        .then(async (data) => {

          if (!data) {
            throw new Error("No se encontraron datos");
          }

          return data.data
        })
        .catch((error) => {
          console.error("Ocurrió un error:", error);
          // Manejo de errores
        });

      if (individualInformation.project_name.includes("-")) {
        const [name, season] = individualInformation.project_name.split("-")

        if (name && season) {
          $('.h-morado').text(`${name}`);
          $('.season').text(`${season}`);
        }
      } else {
        $('.h-morado').text(`${individualInformation.project_name}`);
        $('.ciruclo').remove();
        $('.season').remove();
      }

      $('.list-corredores').each((index, driver) => {
        // Itera sobre los divs dentro de cada "list-corredores" con la clase "div-item-1" a "div-item-10"
        for (let i = 0; i <= information.length; i++) {
          const itemId = i + 1
          const driverInformation = information[i]

          const divItem = $(driver).find(`.div-item-${itemId}`);

          // Accede a la clase "logo-box" dentro de cada div-item
          const logoBox = divItem.find('.logo-box');

          // Accede a la clase "logo-auto-corredor" que es hijo de "logo-box"
          const logoAutoDriver = logoBox.find('.logo-auto-corredor');

          // cambiamos el src del logo
          logoAutoDriver.attr('src', `https://gpesportsrd.com/${driverInformation?.teamData?.value}`);

          // accedemos a la box del name
          const nameDriver = divItem.find('.name-corredor')

          const textName = nameDriver.find('.text-name-corredor')

          // Usamos .html() para mantener el formato HTML
          textName.html(`${driverInformation?.first_name || "unknown"} <span class="span-name">${driverInformation?.last_name || "unknown"}</span>`);

          // Accedemos a los puntos
          const points = divItem.find('.number');

          //Accedemos al texto
          const textPoints = points.find('p');
          textPoints.text(`${driverInformation?.total_points || "0"}`)
        }
      });

      if (sponsorsList.length > 0) {
        $('.fotos-patrocinadores').each((index, sponsor) => {
          // Itera sobre los divs dentro de cada "fotos-patrocinadores"
          for (let i = 0; i < sponsorsList.length; i++) {

            const findSponsor = sponsors.find(sponsor => sponsor.itemId = sponsorsList[i].toString())

            const itemId = i + 1

            // Selecciona el elemento específico dentro de cada iteración
            const sponsorP = $(sponsor).find(`.patrocinador-${itemId}`);

            // Usa .html() para establecer el contenido HTML específico
            sponsorP.html(`<img src="https://gpesportsrd.com/${findSponsor?.value}" style="width: 100%; height: 100%;">`);
          }
        });
      }

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
 * /template/seasonpoints/imageSize:
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
    const { event } = req.query

    if (!event) {
      res.status(400).json({ error: "Faltan parámetros: template, event" });
      return;
    }

    // Buscamos el template
    const htmlFilePath = join(__dirname, `../../public/seasonpoints`, 'index.html');

    // Verifica si el html y el css existen
    const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);

    if (htmlExists) {
      res.json({ width: 1080, height: 1080 });
    } else {
      res.status(404).send({ message: "No se encontró el template" })
    }
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// Exporta el enrutador para su uso en otro lugar
export default router;