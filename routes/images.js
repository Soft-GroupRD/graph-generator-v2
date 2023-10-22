// En tu archivo routes/usuarios.js
import { Router } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { launch } from 'puppeteer';
import fetch, { FormData, File } from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = Router();


/**
 * @swagger
 * /images:
 *   get:
 *     summary: Obtiene la imagen según los parámetros de consulta
 *     parameters:
 *       - name: file
 *         in: query
 *         type: string
 *         description: Los valores del file (imagen) a buscar
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
    const filePath = join(__dirname, '../images/igImages', fileName);

    // Verifica si el archivo PNG ya existe
    const pngExists = await fs.access(filePath).then(() => true).catch(() => false);

    if (pngExists) {
      // Si el archivo PNG existe, enviarlo como respuesta
      res.sendFile(filePath);
    } else {
      // Buscamos el template
      const htmlFilePath = join(__dirname, `../public/${template}`, 'index.html');
      const cssFilePath = join(__dirname, `../public/${template}`, "estilos.css");

      // Verifica si el html y el css existen
      const htmlExists = await fs.access(htmlFilePath).then(() => true).catch(() => false);
      const cssExists = await fs.access(cssFilePath).then(() => true).catch(() => false);

      if (htmlExists && cssExists) {

        // Obtenemos el tamaño relativo del template
        const { width, height } = await fetch(`http://localhost:3500/template/${template}/imageSize?event=${event}&participant=${participant}`)
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

        const browser = await launch({ headless: 'new', args: ['--disable-features=FontsOnDemand'], });
        const page = await browser.newPage();

        // URL de tu página HTML generada dinámicamente
        const dynamicPageURL = `http://localhost:3500/template/${template}/image?event=${event}&participant=${participant}`;

        await page.goto(dynamicPageURL, { waitUntil: 'networkidle0' });


        // Verifica si las conversiones son válidas
        if (!isNaN(width) && !isNaN(height)) {
          // Si los valores son números válidos los seteamos
          await page.setViewport({ width: width, height: height });
        } else {
          res.status(400).send({ message: "Los valores de ancho y alto no son números válidos." })
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
      } else {
        res.status(404).send({ message: "No se encontró el template" })
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/**
 * @swagger
 * /images/{template}/{event}/{participant}:
 *   post:
 *     summary: Envia la imagen al bot
 *     description: Envia la imagen del evento con los respectivos datos al bot
 *     parameters:
 *       - name: template
 *         in: path
 *         required: true
 *         type: string
 *         description: El template de la imagen
 *       - name: event
 *         in: path
 *         required: true
 *         type: string
 *         description: El valor del evento
 *       - name: participant
 *         in: path
 *         required: true
 *         type: string
 *         description: El valor del participante
 *     responses:
 *       200:
 *         description: La imagen fue enviada exitosamente al bot
 *       400:
 *         description: Datos insuficientes o malformados en la solicitud
 *       500:
 *         description: Error interno del servidor
 */
router.post('/:template/:event/:participant', async (req, res) => {
  try {
    // Extraemos los datos para poder traer la info
    const { template, event, participant } = req.params;

    // Manejamos el error si falta algun dato
    if (!template || !event || !participant) {
      res.status(400).json(
        {
          "error": "No se pueden procesar los datos de la solicitud debido a campos faltantes o malformados.",
          "details": {
            "template": !template ? "Falta este campo" : template,
            "event": !event ? "Falta este campo" : event,
            "participant": !participant ? "Falta este campo" : participant
          }
        }
      );
    }

    // Validamos que el evento no sea cero, pero los participantes si
    // Para enviarle a todos los participantes de un evento
    if (event !== "0" && participant === "0") {
      try {
        // Traemos un evento a la vez
        const response = await fetch(`http://20.121.40.254:1337/api/v1/external/getResultsByEventId/${event}`);

        // Manejamos el error si tenemos algun problema en la consulta
        if (!response.ok) {
          throw new Error("Falló la consulta del evento");
        }

        // Almacenamos los datos
        const data = await response.json();

        // Inicializamos la lista de participantes vacia
        const listsOfParticipants = []

        // Validamos si hay datos en el evento
        if (data && data.length > 0) {

          // Recorremos el evento
          for (const currentParticipant of data) {
            try {
              // Generamos o traemos la imagen del participante
              const responseImage = await fetch(`http://localhost:3500/images?file=${template}-${event}-${currentParticipant.individual_id}.png`)

              let errors = []

              // Manejamos el error
              if (!responseImage.ok) {
                // throw new Error("No se encontró ningun participante con ese id");
                errors.push("No se encontró ningun participante con ese id");
                continue;
              }

              // Obtenemos la informacion (numero telefonico) del participante
              const responseParticipant = await fetch(`http://20.121.40.254:1337/api/v1/external/getusers?individual_id=${currentParticipant.individual_id}&type=private`)

              if (!responseParticipant.ok) {
                errors.push("No se encontró informacion del participante");
                continue;
              }

              const participantData = await responseParticipant.json()

              // const imageBase64 = imageData.toString('base64');
              const fromData = {
                participant: {
                  image: `http://localhost:3500/images?file=${template}-${event}-${currentParticipant.individual_id}.png`,
                  phone: participantData[0].celular,
                  name: currentParticipant.first_name,
                  eventName: currentParticipant.trackshortname
                }
              };

              // Enviamos la imagen mediante bot
              const responseBotMessage = await fetch('http://localhost:5000/receive-image-and-json', {
                method: 'POST',
                body: JSON.stringify(fromData),
                headers: {
                  'Content-Type': 'application/json'
                },
                timeout: 60000,
              });

              if (!responseBotMessage.ok) {
                errors.push("No se pudo enviar la imagen");
                continue;
              }

              const botMessageData = await responseBotMessage.json()

              // Agregamos el id del participante y la url de la imagen para luego manipularla
              listsOfParticipants.push({
                participant_id: currentParticipant.individual_id,
                dataSent: fromData,
                bot_message: botMessageData,
                bot_errosr: errors
              })

            } catch (error) {
              // Respondemos con un error si algo falla
              console.error("Ocurrió un error:", error);
              return res.status(500).json({ error: "Fallo en la búsqueda de los participantes" });
            }
          }

          // Agregamos el evento con la data de los participantes
          res.status(200).json(listsOfParticipants)
        } else {
          res.status(404).json({ "not_found": "No se encontró la informacion del evento" })
        }
      } catch (error) {
        console.error("Ocurrió un error:", error);
        // Manejo de errores
        return res.status(500).json({ error: "Fallo en la búsqueda de los últimos eventos" });
      }
    }

    // Validamos que el evento y el participante no sean iguales a 0
    if (event !== "0" && participant !== "0") {
      const responseImage = await fetch(`http://localhost:3500/images?file=${template}-${event}-${participant}.png`)

      let errorImage = "None"

      // Manejamos el error
      if (!responseImage.ok) {
        // throw new Error("No se encontró ningun participante con ese id");
        errorImage = "No se encontró ningun participante con ese id";
      }

      // Obtenemos la informacion (numero telefonico) del participante
      const responseParticipant = await fetch(`http://20.121.40.254:1337/api/v1/external/getusers?individual_id=${participant}&type=private`)

      let errorParticipantInformation = "None"

      if (!responseParticipant.ok) {
        // throw new Error("No se encontró informacion del participante");
        errorParticipantInformation = "No se encontró informacion del participante"
      }

      const participantData = await responseParticipant.json()

      const response = await fetch(`http://20.121.40.254:1337/api/v1/external/getResultsByEventId/${event}`);

      // Manejamos el error si tenemos algun problema en la consulta
      if (!response.ok) {
        throw new Error("Falló la consulta del evento");
      }

      // Almacenamos los datos
      const data = await response.json();

      const findParticipant = await data.find(part => part.individual_id.toString() === participant)

      if (!findParticipant) {
        throw new Error("No de encontró el participante");
      }

      // const imageBase64 = imageData.toString('base64');
      const fromData = {
        participant: {
          image: `http://localhost:3500/images?file=${template}-${event}-${participant}.png`,
          phone: participantData[0].celular,
          name: findParticipant.first_name,
          eventName: findParticipant.trackshortname
        }
      };


      // Enviamos la imagen mediante bot
      const responseBotMessage = await fetch('http://localhost:5000/receive-image-and-json', {
        method: 'POST',
        body: JSON.stringify(fromData),
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000,
      });

      let errorBotMessage = "None"

      if (!responseBotMessage.ok) {
        // throw new Error("No se pudo enviar la imagen");
        errorBotMessage = "No se pudo enviar la imagen"
      }

      const botMessageData = await responseBotMessage.json()

      res.status(200).json({
        participant_id: findParticipant.individual_id,
        dataSent: fromData,
        bot_message: botMessageData,
        bot_errosr: {
          error_image: errorImage,
          error_participant: errorParticipantInformation,
          error_bot: errorBotMessage
        }
      });
    }

    // Validamos que el evento y el participante sean 0, para enviarlo a todos
    if (event === "0" && participant === "0") {
      // Verificamos los eventos, tomamos hace 144 horas (6 días) y que aun le queden un maximo de 2 horas
      const eventsFinished = await fetch('https://gpesportsrd.com/gpt/api/latestevents.php?before=144&future=2')
        .then((response) => {
          if (!response.ok) {
            throw new Error("No se encontró ninguna imagen");
          }
          return response.json();
        })
        .then((data) => {
          return data
        })
        .catch((error) => {
          console.error("Ocurrió un error:", error);
          // Manejo de errores
          res.status(500).json({ error: "Fallo en la busqueda de los ultimos eventos" });
        });

      // Validamos si sí hay eventos
      if (eventsFinished) {
        // Inicializamos la lista de eventos
        const arrayOfEvents = [];

        // Usamos un bucle for...of para poder utilizar 'await'
        for (const currentEvent of eventsFinished) {
          try {
            // Traemos un evento a la vez
            const response = await fetch(`http://20.121.40.254:1337/api/v1/external/getResultsByEventId/${currentEvent.id}`);

            // Manejamos el error si tenemos algun problema en la consulta
            if (!response.ok) {
              throw new Error("Falló la consulta del evento");
            }

            // Almacenamos los datos
            const data = await response.json();

            // Inicializamos la lista de participantes vacia
            const listsOfParticipants = []

            // Validamos si hay datos en el evento
            if (data && data.length > 0) {

              // Recorremos el evento
              for (const currentParticipant of data) {
                try {
                  // Generamos o traemos la imagen del participante
                  const responseImage = await fetch(`http://localhost:3500/images?file=${template}-${currentEvent.id}-${currentParticipant.individual_id}.png`)

                  let errors = []

                  // Manejamos el error
                  if (!responseImage.ok) {
                    // throw new Error("No se encontró ningun participante con ese id");
                    errors.push("No se encontró ningun participante con ese id");
                    continue;
                  }

                  // Obtenemos la informacion (numero telefonico) del participante
                  const responseParticipant = await fetch(`http://20.121.40.254:1337/api/v1/external/getusers?individual_id=${currentParticipant.individual_id}&type=private`)

                  if (!responseParticipant.ok) {
                    errors.push("No se encontró informacion del participante");
                    continue;
                  }

                  const participantData = await responseParticipant.json()

                  // const imageBase64 = imageData.toString('base64');
                  const fromData = {
                    participant: {
                      image: `http://localhost:3500/images?file=${template}-${currentEvent.id}-${currentParticipant.individual_id}.png`,
                      phone: participantData[0].celular,
                      name: currentParticipant.first_name,
                      eventName: currentParticipant.trackshortname
                    }
                  };

                  // Enviamos la imagen mediante bot
                  const responseBotMessage = await fetch('http://localhost:5000/receive-image-and-json', {
                    method: 'POST',
                    body: JSON.stringify(fromData),
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    timeout: 60000,
                  });

                  if (!responseBotMessage.ok) {
                    errors.push("No se pudo enviar la imagen");
                    continue;
                  }

                  const botMessageData = await responseBotMessage.json()

                  // Agregamos el id del participante y la url de la imagen para luego manipularla
                  listsOfParticipants.push({
                    participant_id: currentParticipant.individual_id,
                    dataSent: fromData,
                    bot_message: botMessageData,
                    bot_errosr: errors
                  })

                } catch (error) {
                  // Respondemos con un error si algo falla
                  console.error("Ocurrió un error:", error);
                  return res.status(500).json({ error: "Fallo en la búsqueda de los participantes" });
                }
              }

              // Agregamos el evento con la data de los participantes
              arrayOfEvents.push({
                event: currentEvent.id,
                participants: listsOfParticipants
              })
            } else {
              res.status(404).json({ "not_found": "No se encontró la informacion del evento" })
            }
          } catch (error) {
            console.error("Ocurrió un error:", error);
            // Manejo de errores
            return res.status(500).json({ error: "Fallo en la búsqueda de los últimos eventos" });
          }
        }

        res.status(200).json(arrayOfEvents);
      } else {
        res.status(404).json({ error: "No se encontraron eventos" });
      }
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Exporta el enrutador para su uso en otro lugar
export default router;