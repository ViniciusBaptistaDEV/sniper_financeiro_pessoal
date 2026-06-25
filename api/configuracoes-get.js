// api/configuracoes-get.js
// GET /api/configuracoes
// Retorna as configurações do usuário da aba "Configuracoes".

const { getSheetRows, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'GET')) return;

    try {
        const rows = await getSheetRows('Configuracoes');
        const configRow = rows.find(r => parseInt(r.id, 10) === 1);

        if (!configRow) {
            return res.status(200).json({ 
                ok: true, 
                cartoes: [], 
                has_va_vr: false 
            });
        }

        // Parse cartoes de string JSON para array
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
    } catch (err) {
        console.error('Erro em /api/configuracoes (GET):', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao buscar configurações.' });
    }
};
