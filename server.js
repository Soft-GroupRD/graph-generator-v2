import express from 'express';
import { serve, setup } from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import imageRoutes from './routes/images.js';
import { join } from 'path';
import igwinTemplate from './routes/templates/igwin.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

import swaggerSpec from './swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3500;

app.use('/api-docs', serve, setup(swaggerSpec));

app.use(express.static(join(__dirname, 'public')));

app.use('/fonts', express.static(join(__dirname, 'public')));

app.use('/images', imageRoutes)

app.use('/template/igwin', igwinTemplate)

app.listen(port, () => {
  console.log(`Servidor Node.js escuchando en el puerto ${port}`);
});
