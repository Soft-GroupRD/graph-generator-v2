import fetch from 'node-fetch';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

async function processEventDataAllEvents(template, event) {
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
              rank: currentParticipant.rank,
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
          // return res.status(500).json({ error: "Fallo en la búsqueda de los participantes" });
          throw new Error({ error: "Fallo en la búsqueda de los participantes" });
        }
      }

      // Agregamos el evento con la data de los participantes
      // res.status(200).json(listsOfParticipants)
      return listsOfParticipants
    } else {
      // res.status(404).json({ "not_found": "No se encontró la informacion del evento" })
      throw new Error({"not_found": "No se encontró la informacion del evento" });
    }
  } catch (error) {
    console.error("Ocurrió un error:", error);
    // Manejo de errores
    //return res.status(500).json({ error: "Fallo en la búsqueda de los últimos eventos" });
    throw new Error({ error: "Fallo en la búsqueda de los últimos eventos" });
  }
}

async function processEventDataByEvent(template, event, participant) {
  try {
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
        rank: findParticipant.rank,
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

    /*
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
    */

    return {
      participant_id: findParticipant.individual_id,
      dataSent: fromData,
      bot_message: botMessageData,
      bot_errosr: {
        error_image: errorImage,
        error_participant: errorParticipantInformation,
        error_bot: errorBotMessage
      }
    };
  } catch (error) {
    console.error("Ocurrió un error:", error);
    // Manejo de errores
    // return res.status(500).json({ error: "Fallo en la búsqueda de los últimos eventos" });
    throw new Error({ error: "Fallo en la búsqueda de los últimos eventos" });
  }
}

async function processEventDataByParticipant(template) {
  try {
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
        // res.status(500).json({ error: "Fallo en la busqueda de los ultimos eventos" });
        throw new Error({ error: "Fallo en la busqueda de los ultimos eventos" });
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
                // return res.status(500).json({ error: "Fallo en la búsqueda de los participantes" });
                throw new Error({ error: "Fallo en la búsqueda de los participantes" });
              }
            }

            // Agregamos el evento con la data de los participantes
            arrayOfEvents.push({
              event: currentEvent.id,
              participants: listsOfParticipants
            })
          } else {
            // es.status(404).json({ "not_found": "No se encontró la informacion del evento" })
            throw new Error({ "not_found": "No se encontró la informacion del evento" });
          }
        } catch (error) {
          console.error("Ocurrió un error:", error);
          // Manejo de errores
          // return res.status(500).json({ error: "Fallo en la búsqueda de los últimos eventos" });
          throw new Error({ error: "Fallo en la búsqueda de los últimos eventos" });
        }
      }

      // res.status(200).json(arrayOfEvents);
      return arrayOfEvents
    } else {
      // res.status(404).json({ error: "No se encontraron eventos" });
      throw new Error({ error: "No se encontraron eventos" });
    }
  } catch (error) {
    console.error("Ocurrió un error:", error);
    // Manejo de errores
    // return res.status(500).json({ error: "Fallo en la búsqueda de los últimos eventos" });
    throw new Error({ error: "Fallo en la búsqueda de los últimos eventos" });
  }
}

const { template, event, participant } = workerData;

// Lógica de procesamiento de datos aquí
if (event === "0" && participant === "0") {
  // Manejar caso de evento y participante igual a 0
  console.log('event === "0" && participant === "0"');
  const result = await processEventDataByParticipant(template);
  parentPort.postMessage(result);
} else if (event !== "0" && participant === "0") {
  // Manejar caso de evento distinto de 0 y participante igual a 0
  console.log(template, event, participant);
  const result = await processEventDataAllEvents(template, event);
  parentPort.postMessage(result);
} else if (event !== "0" && participant !== "0") {
  // Manejar caso de evento y participante diferentes de 0
  console.log('event !== "0" && participant !== "0"');
  const result = await processEventDataByEvent(template, event, participant);
  parentPort.postMessage(result);
} else {
  console.log({ else: "Combinación de valores no válida para evento y participante." });
  parentPort.postMessage({ error: "Combinación de valores no válida para evento y participante." });
}
