import requests
import json
import time
import uuid
import random

AEMET_URL = "https://opendata.aemet.es/opendata/api/observacion/convencional/datos/estacion/1495"
AEMET_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyYWRpa2FsYnl0ZXNAZ21haWwuY29tIiwianRpIjoiM2M0OTg4ODEtOTE5Yy00N2RiLWE2YjctZTExNDAwMDdhZjU3IiwiaXNzIjoiQUVNRVQiLCJpYXQiOjE3NDAzMTIwMjgsInVzZXJJZCI6IjNjNDk4ODgxLTkxOWMtNDdkYi1hNmI3LWUxMTQwMDA3YWY1NyIsInJvbGUiOiIifQ.XDrHCESU0Bt03zo1iPzy2oSlxZGL0EWRts0W0yywWBI"

# URL de destino para enviar los datos
DEST_URL = "http://localhost:3000/api/data"

# Generar un UUID único
device_uuid = "c342eafb-dba4-4d7f-8d44-eafd08528743"

# Parámetros del consumo eléctrico estimado
VOLTAGE = 230  # Voltaje típico en España
POWER_MEAN = 400  # Consumo medio en W
POWER_VARIATION = 100  # Variabilidad en W

# Últimos valores conocidos de temperatura y humedad
last_temperature = None
last_humidity = None

def obtener_datos_meteorologicos():
    """Obtiene la temperatura y humedad desde la API de AEMET con hasta 3 reintentos."""
    global last_temperature, last_humidity
    intentos = 0

    while intentos < 3:
        try:
            headers = {"api_key": AEMET_API_KEY}
            response = requests.get(AEMET_URL, headers=headers)

            if response.status_code == 200:
                data = response.json()
                if "datos" in data:
                    datos_url = data["datos"]
                    response_data = requests.get(datos_url)

                    if response_data.status_code == 200:
                        datos_meteorologicos = response_data.json()
                        if datos_meteorologicos:
                            temperatura = datos_meteorologicos[0].get("ta", None)  # 'ta' es la temperatura
                            humedad = datos_meteorologicos[0].get("hr", None)  # 'hr' es la humedad

                            if temperatura is not None and humedad is not None:
                                last_temperature, last_humidity = round(temperatura, 1), round(humedad, 1)
                                return last_temperature, last_humidity

        except Exception as e:
            print(f"⚠ Intento {intentos + 1} fallido: {e}")

        intentos += 1
        time.sleep(2)  # Espera breve antes de reintentar

    print("❌ No se pudieron obtener datos meteorológicos tras 3 intentos.")
    if last_temperature is not None and last_humidity is not None:
        print(f"🔄 Usando últimos valores conocidos: Temperatura {last_temperature}°C, Humedad {last_humidity}%")
        return last_temperature, last_humidity
    else:
        print("⚠ No hay valores previos, omitiendo datos meteorológicos en el envío.")
        return None, None  # No se tienen datos previos

while True:
    try:
        # Obtener temperatura y humedad
        temperature, humidity = obtener_datos_meteorologicos()

        # Generar valores de consumo eléctrico simulados
        power = random.uniform(POWER_MEAN - POWER_VARIATION, POWER_MEAN + POWER_VARIATION)  # W
        irms = power / VOLTAGE  # A

        # Crear el payload en formato JSON
        payload = {
            "uuid": device_uuid,
            "irms": round(irms, 2),
            "power": round(power, 2)
        }

        # Solo incluir temperatura y humedad si hay valores válidos
        if temperature is not None and humidity is not None:
            payload["temperature"] = temperature
            payload["humidity"] = humidity

        # Enviar los datos mediante una solicitud POST
        headers = {'Content-Type': 'application/json'}
        post_response = requests.post(DEST_URL, data=json.dumps(payload), headers=headers)

        if post_response.status_code == 200:
            print("✅ Datos enviados correctamente:", payload)
        else:
            print(f"❌ Error al enviar los datos: {post_response.status_code}", payload)

    except Exception as e:
        print(f"❌ Se produjo un error: {e}")

    # Esperar 60 segundos antes de la siguiente solicitud
    time.sleep(60)