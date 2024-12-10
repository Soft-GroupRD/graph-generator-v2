// En tu archivo routes/usuarios.js
import { Router } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import sharp from 'sharp';
import path from 'path';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function resizeImage(inputPath, outputPath, width, height) {
  try {
    await sharp(inputPath)
      .resize({ width, height, fit: 'contain' })
      .toFile(outputPath);
    console.log(`Image resized successfully: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Error resizing image: ${error.message}`);
    return null;
  }
}
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


/**
 * Función de utilidad para manejar fetch con manejo de errores.
 * @param {string} url - URL a la que se hace el fetch.
 * @returns {Promise<any>} - Respuesta JSON del fetch.
 */
async function fetchWithRetry(url, errorMessage) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${errorMessage}. Código de estado: ${response.status}`);
    }
    const data = await response.json();
    if (!data) {
      throw new Error(`${errorMessage}. Respuesta vacía o inválida.`);
    }
    return data;
  } catch (error) {
    console.error(`Error al realizar fetch: ${url}`, error.message);
    throw error;
  }
}

/**
 * Endpoint para obtener la imagen con los parámetros proporcionados.
 */


router.get('/image', async (req, res) => {
  try {
    const { event } = req.query;

    if (!event) {
      res.status(400).json({ error: "Faltan parámetros: template, event" });
      return;
    }

    const htmlFilePath = join(__dirname, `../../public/seasonpoints`, 'index.html');
    const cssFilePath = join(__dirname, `../../public/seasonpoints/css`, "estilos.css");

    const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);
    const cssExists = await fs.access(cssFilePath).then(() => true).catch(() => false);

    if (!htmlExists || !cssExists) {
      res.status(404).send({ message: "No se encontró el template" });
      return;
    }

    const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
    const cssContent = await fs.readFile(cssFilePath, 'utf-8');

    const rawData = await fetchWithRetry(
      `https://api4.gpesportsrd.com/season_status/pilot_points?project_id=${event}`,
      "Fallo al buscar el evento"
    );

    const topDrivers = rawData
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 10);

      const enrichedDrivers = await Promise.all(
        topDrivers.map(async (driver) => {
          try {
            console.log(`Processing driver: ${JSON.stringify(driver, null, 2)}`); // Log each driver before processing
      
            if (!driver.team_id) {
              console.warn(`team_id missing for driver: ${driver.first_name} ${driver.last_name}`);
              return null;
            }
      
            const teamData = await fetchWithRetry(
              `https://api4.gpesportsrd.com/fieldValues?field_id=37&item_id=${driver.team_id}`,
              `Failed to fetch team data for driver: ${driver.first_name} ${driver.last_name}`
            );
  
            if (teamData.data?.[0]?.value) {
              const teamLogoUrl = `https://gpesportsrd.com/${teamData.data[0].value}`;
              const outputPath = join(__dirname, `../../public/processed_images/team_${driver.team_id}.png`);
  
              // Resize the team logo using Sharp
              await resizeImage(teamLogoUrl, outputPath, 100, 100);
              teamData.data[0].processedValue = outputPath; // Add processed path
            }
      
            console.log(`Fetched team data for driver ${driver.first_name}: ${JSON.stringify(teamData, null, 2)}`); // Log team data
      
            return {
              ...driver,
              teamData: teamData.data?.[0] || null,
            };
          } catch (error) {
            console.error(`Error processing driver ${driver.first_name}: ${error.message}`);
            return null;
          }
        })
      );
      
      // Log the final enrichedDrivers array
      console.log("Enriched Drivers Array:", JSON.stringify(enrichedDrivers, null, 2));

      const sponsorsRaw = await fetchWithRetry(
        `https://api4.gpesportsrd.com/fieldValues?field_id=55`,
        "Fallo al buscar los sponsors"
      );
      
      // Add console logs to inspect the response and validate the data
      console.log("Sponsors API URL:", `https://api4.gpesportsrd.com/fieldValues?field_id=55`);
      
      try {
        console.log("Raw Sponsors Response:", JSON.stringify(sponsorsRaw, null, 2)); // Inspect raw response
      } catch (error) {
        console.error("Error parsing sponsors response:", error.message); // Handle unexpected response
      }
      
      const sponsors = sponsorsRaw.data || [];
      console.log("Parsed Sponsors Data:", JSON.stringify(sponsors, null, 2));

    const $ = load(htmlContent);

    // Actualización de DOM
    const individualInformation = enrichedDrivers[0];
    const sponsorsList = individualInformation?.project_sponsors
      ? JSON.parse(individualInformation.project_sponsors)
      : [];

    if (individualInformation.project_name.includes("-")) {
      const [name, season] = individualInformation.project_name.split("-");
      $('.h-morado').text(name);
      $('.season').text(season);
    } else {
      $('.h-morado').text(individualInformation.project_name);
      $('.ciruclo').remove();
      $('.season').remove();
    }

    $('.list-corredores').each((index, driver) => {
      for (let i = 0; i < enrichedDrivers.length; i++) {
        const itemId = i + 1;
        const driverInfo = enrichedDrivers[i];
        if (!driverInfo) continue;

        const divItem = $(driver).find(`.div-item-${itemId}`);
        divItem.find('.logo-auto-corredor').attr('src', `https://gpesportsrd.com/${driverInfo.teamData?.value}`);
        divItem.find('.text-name-corredor').html(`${driverInfo.first_name || "unknown"} <span class="span-name">${driverInfo.last_name || "unknown"}</span>`);
        divItem.find('.number p').text(driverInfo.total_points || "0");
      }
    });
    console.log("Sponsors List:", sponsorsList);

    if (sponsorsList.length > 0) {
      console.log("Sponsors List IDs:", sponsorsList);
      console.log("Sponsors Data:", JSON.stringify(sponsors, null, 2));
    
      $('.fotos-patrocinadores').each((index, sponsorContainer) => {
        for (let i = 0; i < sponsorsList.length; i++) {
          // Find the sponsor data by matching the item ID
          const sponsorData = sponsors.find((s) => s.item_id === sponsorsList[i].toString());
          if (!sponsorData) {
            console.warn(`No sponsor found for ID: ${sponsorsList[i]}`);
            continue;
          }
    
          // Construct the image path for the sponsor
          const sponsorImagePath = `https://gpesportsrd.com${sponsorData.value}`;
          console.log(`Sponsor image path: ${sponsorImagePath}`);
    
          const itemId = i + 1; // Sponsor box ID starts from 1
          const sponsorBox = $(sponsorContainer).find(`.patrocinador-${itemId}`);
    
          // Replace "P" with the sponsor image
          sponsorBox.html(`<img src="${sponsorImagePath}" style="width: 100%; height: 100%;">`);
          console.log(`Updated .patrocinador-${itemId} with sponsor image.`);
        }
      });
    
      // Log the final HTML to verify updates
      console.log("Modified HTML after sponsors update:", $.html());
    }

    $('<style>').text(cssContent).appendTo('head');
    res.send($.html());
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * Endpoint para obtener el tamaño del template.
 */
router.get('/imageSize', async (req, res) => {
  try {
    const { event } = req.query;

    if (!event) {
      res.status(400).json({ error: "Faltan parámetros: template, event" });
      return;
    }

    const htmlFilePath = join(__dirname, `../../public/seasonpoints`, 'index.html');
    const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);

    if (!htmlExists) {
      res.status(404).send({ message: "No se encontró el template" });
      return;
    }

    res.json({ width: 1080, height: 1080 });
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