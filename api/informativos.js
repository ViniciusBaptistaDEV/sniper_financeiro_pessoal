// api/informativos.js
// GET /api/informativos
// Retorna os informativos cadastrados na aba "Informativos".
// Não há "competência mensal" — o `dia_cobranca` é o dia do mês em que
// a cobrança acontece. O parâmetro `mes` é aceito por compatibilidade com
// o frontend, mas é ignorado neste momento.

const { getSheetRows, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'GET')) return;

    try {
        const informativos = await getSheetRows('Informativos');
        return res.status(200).json({ ok: true, informativos });
    } catch (err) {
        console.error('Erro em /api/informativos:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao buscar informativos.' });
    }
};
