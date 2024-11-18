import { promises as fs } from 'fs';
import { launch } from 'puppeteer';
import fetch from 'node-fetch';

/**
 * Verifica si un archivo existe en el sistema.
 * @param {string} path - Ruta del archivo.
 * @returns {Promise<boolean>} - Verdadero si el archivo existe, falso en caso contrario.
 */
export const fileExists = async (path) => {
  return fs.access(path).then(() => true).catch(() => false);
};

/**
 * Realiza una solicitud HTTP GET y devuelve un JSON.
 * @param {string} url - URL a la cual se realizará la solicitud.
 * @returns {Promise<Object>} - Respuesta en formato JSON.
 */
export const fetchJSON = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error fetching ${url}: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch data");
  }
};

/**
 * Captura una captura de pantalla de una página y la guarda en un archivo.
 * @param {string} url - URL de la página.
 * @param {number} width - Ancho de la página.
 * @param {number} height - Alto de la página.
 * @param {string} outputPath - Ruta donde se guardará la captura.
 */
export const captureScreenshot = async (url, width, height, outputPath) => {
  const browser = await launch({ headless: 'new', args: ['--disable-features=FontsOnDemand'] });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  if (!isNaN(width) && !isNaN(height)) {
    await page.setViewport({ width, height });
  } else {
    throw new Error("Invalid width or height values");
  }

  await page.screenshot({ path: outputPath, type: 'png' });
  await browser.close();
};
