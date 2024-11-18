import { Router } from 'express';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Worker, isMainThread } from 'worker_threads';
import { fileExists, fetchJSON, captureScreenshot } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = Router();

/**
 * @swagger
 * tags:
 *   name: Images
 *   description: Operaciones relacionadas con la generación y obtención de imágenes
 */

/**
 * @swagger
 * /images:
 *   get:
 *     summary: Genera o recupera una imagen basada en parámetros proporcionados
 *     tags: [Images]
 *     description: Permite obtener una imagen existente o generar una nueva basada en el template, evento y participante especificados en el nombre del archivo.
 *     parameters:
 *       - name: file
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           example: "igwin-1234-5678.png"
 *         description: Nombre del archivo en formato `{template}-{event}-{participant}.png`
 *     responses:
 *       200:
 *         description: Imagen obtenida o generada exitosamente
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Error en los parámetros proporcionados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid file syntax"
 *       404:
 *         description: Template o imagen no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Template not found"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/', async (req, res) => {
  try {
    const { file } = req.query;

    if (!file?.includes('-') || !file.endsWith('.png')) {
      return res.status(400).json({ error: "Invalid file syntax" });
    }

    const [template, event, participant] = file.replace('.png', '').split('-');
    const filePath = join(
      __dirname,
      template === 'igwin' ? '../images/igImages' : '../images/seasonPointsImages',
      file
    );

    if (await fileExists(filePath)) {
      return res.sendFile(filePath);
    }

    const htmlFilePath = join(__dirname, `../public/${template}`, 'index.html');
    const cssFilePath = join(__dirname, `../public/${template}`, 'estilos.css');

    if (!(await fileExists(htmlFilePath)) || !(await fileExists(cssFilePath))) {
      return res.status(404).json({ error: "Template not found" });
    }

    const dimensionsUrl = `http://localhost:3500/template/${template}/imageSize?event=${event}&participant=${participant || ''}`;
    const { width, height } = await fetchJSON(dimensionsUrl);

    const dynamicPageURL = `http://localhost:3500/template/${template}/image?event=${event}&participant=${participant}`;
    await captureScreenshot(dynamicPageURL, width, height, filePath);

    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /images/{template}/{event}/{participant}:
 *   get:
 *     summary: Genera y envía imágenes al bot
 *     tags: [Images]
 *     description: Procesa y genera imágenes para un evento y un participante específico, o para todos los participantes en caso de que el parámetro `participant` sea `0`.
 *     parameters:
 *       - name: template
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "igwin"
 *         description: Nombre del template a utilizar
 *       - name: event
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "1234"
 *         description: ID del evento. Use `0` para enviar imágenes para todos los eventos recientes.
 *       - name: participant
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: "5678"
 *         description: ID del participante. Use `0` para enviar imágenes a todos los participantes del evento.
 *     responses:
 *       200:
 *         description: Imágenes procesadas y enviadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 participant_id:
 *                   type: string
 *                   example: "5678"
 *                 dataSent:
 *                   type: object
 *                   properties:
 *                     participant:
 *                       type: object
 *                       properties:
 *                         image:
 *                           type: string
 *                           example: "http://localhost:3500/images?file=igwin-1234-5678.png"
 *                         phone:
 *                           type: string
 *                           example: "+1234567890"
 *                         name:
 *                           type: string
 *                           example: "John Doe"
 *                         rank:
 *                           type: string
 *                           example: "1"
 *                         eventName:
 *                           type: string
 *                           example: "Event Name"
 *                 bot_message:
 *                   type: object
 *                   description: Respuesta del bot al recibir los datos
 *                 bot_errors:
 *                   type: object
 *                   properties:
 *                     error_image:
 *                       type: string
 *                       example: "None"
 *                     error_participant:
 *                       type: string
 *                       example: "None"
 *                     error_bot:
 *                       type: string
 *                       example: "None"
 *       400:
 *         description: Parámetros faltantes o inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing template, event, or participant parameters"
 *       404:
 *         description: No se encontraron eventos o participantes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No events or participants found"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/:template/:event/:participant', async (req, res) => {
  try {
    const { template, event, participant } = req.params;

    if (!template || !event || !participant) {
      return res.status(400).json({ error: "Missing template, event, or participant parameters" });
    }

    if (isMainThread) {
      const worker = new Worker(`${__dirname}/worker.js`, { workerData: { template, event, participant } });
      worker.on('message', (message) => res.json(message));
    } else {
      res.status(500).json({ error: "Worker threads not supported here" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
