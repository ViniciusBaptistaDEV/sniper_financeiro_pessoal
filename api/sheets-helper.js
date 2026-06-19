// api/sheets-helper.js
// Helpers centralizados: autenticação Google Sheets + leitura/gravação de abas.

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

let cachedDoc = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s de cache para evitar travar a API do Sheets

/**
 * Retorna uma instância autenticada da planilha do Google Sheets.
 * Usa cache em memória para reduzir o tempo de resposta entre invocações.
 */
async function getDoc() {
    const now = Date.now();

    // Reutiliza o doc se o cache ainda estiver válido
    if (cachedDoc && (now - cachedAt) < CACHE_TTL_MS) {
        return cachedDoc;
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    // O private key vem com \n escapado nas envs do Vercel; precisamos normalizar
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!spreadsheetId || !clientEmail || !privateKey) {
        throw new Error(
            'Variáveis de ambiente ausentes. Defina SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.'
        );
    }

    const serviceAccountAuth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await doc.loadInfo(); // carrega metadados da planilha

    cachedDoc = doc;
    cachedAt = now;
    return doc;
}

/**
 * Lê todas as linhas de uma aba e devolve como array de objetos
 * (cabeçalho na primeira linha).
 */
async function getSheetRows(sheetTitle) {
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
        throw new Error(`Aba "${sheetTitle}" não encontrada na planilha.`);
    }
    const rows = await sheet.getRows();
    return rows.map((r) => r.toObject());
}

/**
 * Adiciona uma nova linha na aba informada com base em um objeto.
 * Gera automaticamente o próximo id sequencial (id, id, id).
 */
async function addSheetRow(sheetTitle, dataObj) {
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
        throw new Error(`Aba "${sheetTitle}" não encontrada na planilha.`);
    }

    const rows = await sheet.getRows();
    const headerValues = sheet.headerValues; // ['id', 'descricao', ...]
    const idColumn = headerValues[0]; // sempre a primeira coluna

    // Calcula próximo id (se a coluna id existir)
    let nextId = 1;
    if (headerValues.includes(idColumn)) {
        const maxId = rows.reduce((acc, r) => {
            const v = parseInt(r.get(idColumn), 10);
            return Number.isFinite(v) && v > acc ? v : acc;
        }, 0);
        nextId = maxId + 1;
    }

    const payload = { [idColumn]: nextId, ...dataObj };
    const created = await sheet.addRow(payload);
    return { id: nextId, row: created.toObject() };
}

/**
 * Helpers de parsing usados em vários handlers.
 */
function toNumber(v) {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

function toInt(v) {
    if (v === undefined || v === null || v === '') return 0;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Aplica cabeçalhos CORS padrão em todas as respostas.
 */
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

/**
 * Shortcut: só responde OPTIONS e valida método, senão devolve null.
 * Retorna `true` se a request foi tratada (não prosseguir).
 */
function handlePreflightOrMethod(req, res, method) {
    setCors(res);
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    if (req.method !== method) {
        res.status(405).json({ ok: false, error: `Método não permitido. Use ${method}.` });
        return true;
    }
    return false;
}

module.exports = {
    getDoc,
    getSheetRows,
    addSheetRow,
    toNumber,
    toInt,
    setCors,
    handlePreflightOrMethod,
};
