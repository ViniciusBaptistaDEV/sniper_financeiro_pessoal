// api/login.js
// Autentica o usuário comparando com as variáveis de ambiente APP_LOGIN e APP_PASSWORD.
// Em caso de sucesso, devolve um token simples (assinatura) que o front guarda no sessionStorage.

const crypto = require('crypto');

function buildSessionToken(login) {
    const secret = process.env.SESSION_SECRET || 'sniper-financeiro-default-secret';
    // Token = base64(login).assinatura
    const payload = Buffer.from(JSON.stringify({ u: login, t: Date.now() })).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

module.exports = async function handler(req, res) {
    // CORS básico
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Método não permitido.' });
    }

    try {
        const { user, pass } = req.body || {};

        const validUser = process.env.APP_LOGIN;
        const validPass = process.env.APP_PASSWORD;

        if (!validUser || !validPass) {
            return res.status(500).json({
                ok: false,
                error: 'Credenciais não configuradas no servidor (APP_LOGIN/APP_PASSWORD).',
            });
        }

        if (
            typeof user !== 'string' ||
            typeof pass !== 'string' ||
            user !== validUser ||
            pass !== validPass
        ) {
            return res.status(401).json({ ok: false, error: 'Usuário ou senha inválidos.' });
        }

        const token = buildSessionToken(user);
        return res.status(200).json({ ok: true, token });
    } catch (err) {
        console.error('Erro em /api/login:', err);
        return res.status(500).json({ ok: false, error: 'Erro interno no login.' });
    }
};
