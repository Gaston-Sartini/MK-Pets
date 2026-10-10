-- Transferencia como medio de pago propio. Antes estaba mezclada con
-- "efectivo al recibir" y el admin no podía distinguir quién debía transferir.
alter type public."PaymentMethod" add value if not exists 'TRANSFER';
