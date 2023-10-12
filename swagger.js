const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  swaggerDefinition: {
    info: {
      title: 'Mi API',
      version: '1.0.0',
      description: 'Documentación de mi API con Swagger',
    },
    basePath: '/',
  },
  apis: ['./routes/*.js'], // Rutas donde se encuentran tus definiciones de rutas de Express
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
