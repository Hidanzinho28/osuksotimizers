'use strict';
const {nextStatus,eventStatus,PaymentError} = require('./payment-rules.cjs');
let pool,initializing;
const schema = `
CREATE TABLE IF NOT EXISTS osuk_orders (
 id uuid PRIMARY KEY, idempotency_key uuid UNIQUE NOT NULL, fingerprint text NOT NULL,
 pack text NOT NULL CHECK (pack IN ('ultra','valorant','completo')), email text NOT NULL,
 amount_cents integer NOT NULL CHECK (amount_cents > 0), access_hash text UNIQUE NOT NULL,
 access_expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','refunded')),
 phase text NOT NULL DEFAULT 'creating' CHECK (phase IN ('creating','ready','uncertain','failed')),
 provider_id text UNIQUE, pix jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS osuk_webhook_events (id text PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS osuk_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS osuk_rate_limits_expiry ON osuk_rate_limits (expires_at);
`;
function map(row) { return row && {id:row.id,key:row.idempotency_key,fingerprint:row.fingerprint,pack:row.pack,email:row.email,amountCents:row.amount_cents,accessHash:row.access_hash,accessExpiresAt:row.access_expires_at,status:row.status,phase:row.phase,providerId:row.provider_id,pix:row.pix}; }
async function db() {
  if(!pool) { const {Pool} = require('pg'); pool = new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,statement_timeout:12000}); pool.on('error',()=>console.error('OSUK: falha de conexão com o banco.')); }
  if(!initializing) initializing = (async()=>{const client=await pool.connect();try {await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(736827491)");await client.query(schema);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}})().catch(error=>{initializing=null;throw error;});
  await initializing; return pool;
}
async function rateLimit(key,limit,seconds) {
  const pool=await db();
  // Limpa apenas contadores expirados, em lotes pequenos.
  await pool.query('DELETE FROM osuk_rate_limits WHERE key IN (SELECT key FROM osuk_rate_limits WHERE expires_at<now() LIMIT 100)');
  const {rows}=await pool.query(`INSERT INTO osuk_rate_limits (key,count,expires_at) VALUES ($1,1,now()+($2::integer*interval '1 second')) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN osuk_rate_limits.expires_at<=now() THEN 1 ELSE osuk_rate_limits.count+1 END, expires_at=CASE WHEN osuk_rate_limits.expires_at<=now() THEN now()+($2::integer*interval '1 second') ELSE osuk_rate_limits.expires_at END RETURNING count`,[key,seconds]);
  if(rows[0].count>limit) throw new PaymentError(429,'Muitas tentativas. Aguarde um pouco antes de continuar.');
}
async function reserve(order) {
  const pool=await db();
  const result=await pool.query(`INSERT INTO osuk_orders (id,idempotency_key,fingerprint,pack,email,amount_cents,access_hash,access_expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,[order.id,order.key,order.fingerprint,order.pack,order.email,order.amountCents,order.accessHash,order.accessExpiresAt]);
  if(result.rows[0]) return {inserted:true,order:map(result.rows[0])};
  return {inserted:false,order:map((await pool.query('SELECT * FROM osuk_orders WHERE idempotency_key=$1',[order.key])).rows[0])};
}
async function getByToken(hash) {return map((await (await db()).query('SELECT * FROM osuk_orders WHERE access_hash=$1 AND access_expires_at>now()',[hash])).rows[0]);}
async function getById(id) {return map((await (await db()).query('SELECT * FROM osuk_orders WHERE id=$1',[id])).rows[0]);}
async function savePayment(id,payment) {const result=await (await db()).query("UPDATE osuk_orders SET provider_id=COALESCE(provider_id,$2),pix=$3,phase='ready' WHERE id=$1 AND (provider_id IS NULL OR provider_id=$2)",[id,payment.providerId,JSON.stringify(payment.pix)]);if(result.rowCount!==1) throw new PaymentError(502,'Não foi possível associar a cobrança ao pedido. Entre no Discord antes de repetir.');}
async function markUncertain(id) {await (await db()).query("UPDATE osuk_orders SET phase='uncertain' WHERE id=$1 AND phase='creating'",[id]);}
async function handleEvent(event) {
  const client=await (await db()).connect();
  try {
    await client.query('BEGIN');
    const inserted=await client.query('INSERT INTO osuk_webhook_events (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id',[event.id]);
    if(!inserted.rows.length) {await client.query('COMMIT');return;}
    const data=event.data;
    const row=(await client.query('SELECT * FROM osuk_orders WHERE id=$1 FOR UPDATE',[data.externalReference])).rows[0];
    if(row) {
      const order=map(row),status=eventStatus(event.event,data,order);
      if(!status) throw new PaymentError(422,'Notificação não corresponde ao pedido.');
      await client.query('UPDATE osuk_orders SET status=$2,provider_id=COALESCE(provider_id,$3) WHERE id=$1',[order.id,nextStatus(order.status,status),data.id]);
    }
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
module.exports={rateLimit,reserve,getByToken,getById,savePayment,markUncertain,handleEvent,schema};
