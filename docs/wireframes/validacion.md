# Validación del prototipo

6 de noviembre de 2026. Pruebas sobre el fragmento renderizado en un iframe con Edge headless. No se modificó código de producción.

## Comprobado

- Una nota inválida muestra error y conserva el valor ingresado.
- Guardar `6,0` funciona y vuelve a Inicio cuando ese fue el origen.
- El ejemplo de Cálculo II pasa de 5,4 a 5,7 como promedio parcial de dos notas de igual peso (5,4 y 6,0). No representa el cálculo de un ramo real con reglas especiales ni cambia el PPA.
- Deshacer recupera la nota pendiente y el promedio anterior.
- Cambiar de ramo no transfiere la nota que se estaba escribiendo.
- El cajón deja inerte el contenido de fondo; Escape lo cierra y devuelve el foco a Menú.
- Al elegir Mi malla, Inicio no queda seleccionado en la barra móvil.
- No se observó desbordamiento horizontal del contenedor en los anchos de navegador 320, 375, 390, 768 y 1024px con el modo móvil activado.
- No se registraron errores de ejecución de JavaScript en ese recorrido.
- Inspección visual de Inicio de escritorio, Inicio móvil claro y registro móvil oscuro.

Se corrigió una incompatibilidad del envío nativo de formularios con la vista interactiva: el control Guardar ejecuta ahora directamente la validación y el guardado de ejemplo.

## Pendiente para la implementación

- Prueba en teléfono real con teclado virtual, lector de pantalla, ampliación de texto y auditoría completa de contraste.
- Integración con los cálculos, reglas, persistencia, navegación histórica y sincronización reales.
- Recuperación explícita de borradores entre destinos, estados sin datos, ponderaciones avanzadas y alertas académicas.
- Prototipado del contenido de Agenda y demás secciones. Sus destinos actuales solo permiten revisar la organización del menú.

Los datos solo viven en memoria y se restablecen al recargar. Los casos ampliados de revision-flujos.md son criterios futuros, no pruebas todas completadas. No se ejecutaron tests de producción porque los cambios se limitan a documentación y al prototipo aislado.
