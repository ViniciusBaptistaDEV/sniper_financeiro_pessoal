// api/configuracoes.js
// Agrupador de rotas para Configurações
// GET    /api/configuracoes         -> Retorna as configurações
// POST   /api/configuracoes         -> Salva as configurações

const { getDoc, getSheetRows, handlePreflightOrMethod, setCors } = require('../lib/sheets-helper');

module.exports = async function handler(req, res) {
    setCors(res);
    const { method } = req;

    if (method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // --- GET: Busca configurações ---
        if (method === 'GET') {
            const rows = await getSheetRows('Configuracoes');
            const configRow = rows.find(r => parseInt(r.id, 10) === 1);

            if (!configRow) {
                return res.status(200).json({ 
                    ok: true, 
                    cartoes: [], 
                    has_va_vr: false 
                });
            }

            let cartoes = [];
            try {
                cartoes = JSON.parse(configRow.cartoes || '[]');
            } catch (e) {
                cartoes = [];
            }

            return res.status(200).json({
                ok: true,
                cartoes: cartoes,
                has_va_vr: configRow.has_va_vr === 'TRUE'
            });
        }

        // --- POST: Salva configurações ---
        if (method === 'POST') {
            const body = req.body || {};
            const doc = await getDoc();
            let sheet = doc.sheetsByTitle['Configuracoes'];

            if (!sheet) {
                sheet = await doc.addSheet({ title: 'Configuracoes', headerValues: ['id', 'cartoes', 'has_va_vr'] });
            } else {
                try {
                    await sheet.loadHeaderRow();
                } catch (e) {
                    await sheet.setHeaderRow(['id', 'cartoes', 'has_va_vr']);
                }

                const headerValues = sheet.headerValues;
                if (!headerValues || headerValues.length === 0 || !headerValues.includes('id')) {
                    await sheet.setHeaderRow([ 'id', 'cartoes', 'has_va_vr' ]);
                }
            }

            const rows = await sheet.getRows();
            const configRow = rows.find(r => parseInt(r.get('id'), 10) === 1);

            const payload = {
                cartoes: JSON.stringify(body.cartoes || []),
                has_va_vr: body.has_va_vr ? 'TRUE' : 'FALSE'
            };

            if (configRow) {
                Object.keys(payload).forEach(key => configRow.set(key, payload[key]));
                await configRow.save();
            } else {
                await sheet.addRow({ id: 1, ...payload });
            }

            return res.status(200).json({ ok: true, message: 'Configurações salvas com sucesso.' });
        }

        return res.status(405).json({ ok: false, error: 'Método não permitido.' });

    } catch (err) {
        console.error('Erro em /api/configuracoes:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao processar configurações.' });
    }
};
