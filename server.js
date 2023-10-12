const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const imageRoutes = require('./routes/images');
const path = require('path');

const igwinTemplate = require('./routes/templates/igwin')

const app = express();
const port = 5500;

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: 'Mi API',
      version: '1.0.0',
      description: 'Documentación de mi API con Swagger',
    },
  },
  apis: ['routes/*.js'], // Rutas donde se encuentran tus definiciones de rutas de Express
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/fonts', express.static(path.join(__dirname, 'public')));

app.use('/images', imageRoutes)

app.use('/templates', igwinTemplate)

app.listen(port, () => {
  console.log(`Servidor Node.js escuchando en el puerto ${port}`);
});
