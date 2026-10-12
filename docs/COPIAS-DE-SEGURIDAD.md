# Copias de seguridad de la base

## Qué se copia y cuándo

Todos los domingos a las 4:00 se hace sola una copia de la base: productos, categorías, pedidos y datos de clientes. La hace GitHub (`.github/workflows/backup.yml`) y la deja guardada 90 días.

Las fotos de los productos no entran en esta copia: están en el almacenamiento de Supabase. Tampoco entra el usuario del panel (email y contraseña del admin): si hubiera que armar todo de cero, se crea de nuevo desde Supabase.

Probada el 12/10/2026: se bajó la copia, se descifró con la clave y traía los 22 productos, las 7 categorías y las variantes.

## Dónde está

En GitHub → pestaña **Actions** → **Copia de seguridad** → la corrida que quieras → sección **Artifacts**. Se baja un `.zip` con un archivo `mk-pets-AAAA-MM-DD.sql.gz.gpg`.

## Por qué está cifrada

La copia tiene nombres, direcciones y teléfonos de clientes, y el repositorio es público. El archivo está cifrado: sin la clave no se puede leer.

**La clave** es `BACKUP_PASSPHRASE`. Está en dos lugares:

- En los *secrets* del repositorio de GitHub (ahí la usa la copia automática; no se puede volver a ver).
- En el archivo `.env.local` del proyecto, en tu PC.

Si se pierden las dos, las copias viejas no sirven. Conviene anotarla en un lugar seguro.

## Si la copia falla

Se abre solo un aviso en GitHub con la etiqueta `copia`, y se cierra solo cuando la copia vuelve a andar.

Un detalle técnico por si vuelve a fallar con "Network is unreachable": la dirección directa de la base (`db.….supabase.co`) solo funciona por IPv6 y las máquinas de GitHub no tienen IPv6. Por eso la copia entra por el *pooler* de Supabase (`aws-1-sa-east-1.pooler.supabase.com`), que es la misma base con otra puerta.

## Cómo restaurar

Hace falta `gpg` y `psql` instalados, o pedírselo a Claude desde la carpeta del proyecto.

```bash
gpg --decrypt --output copia.sql.gz mk-pets-AAAA-MM-DD.sql.gz.gpg
```

```bash
gunzip copia.sql.gz
```

```bash
psql "URL_DE_LA_BASE" -f copia.sql
```

Restaurar encima de una base con datos pisa lo que haya. Ante la duda, restaurar primero en un proyecto nuevo de Supabase y revisar.
