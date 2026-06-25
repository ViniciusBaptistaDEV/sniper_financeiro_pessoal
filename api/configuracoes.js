// api/configuracoes.js
// POST /api/configuracoes
// Salva as configurações do usuário na aba "Configuracoes".
// Como as configurações são globais para o usuário, vamos manter apenas uma linha (id=1).
// Body esperado: { cartoes: [], has_va_vr: boolean }

const { getDoc, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'POST')) return;

    try {
        const body = req.body || {};
        const doc = await getDoc();
        let sheet = doc.sheetsByTitle['Configuracoes'];

        if (!sheet) {
            // Cria a aba se não existir, já inserindo os cabeçalhos corretamente (v4)
            sheet = await doc.addSheet({ title: 'Configuracoes', headerValues: ['id', 'cartoes', 'has_va_vr'] });
        } else {
            // Tenta carregar os cabeçalhos PRIMEIRO
            try {
                await sheet.loadHeaderRow();
            } catch (e) {
                // Se der erro ao carregar, significa que a aba existe, mas a linha 1 está vazia.
                // Então nós criamos os cabeçalhos.
                await sheet.setHeaderRow(['id', 'cartoes', 'has_va_vr']);
            }

            // Agora sim é 100% seguro checar se o headerValues está correto
            const headerValues = sheet.headerValues;
            if (!headerValues || headerValues.length === 0 || !headerValues.includes('id')) {
                await sheet.setHeaderRow([ 'id', 'cartoes', 'has_va_vr' ]);
            }
        }

        // Continua pegando as linhas normalmente
        const rows = await sheet.getRows();
        const configRow = rows.find(r => parseInt(r.get('id'), 10) === 1);

        const payload = {
            cartoes: JSON.stringify(body.cartoes || []),
            has_va_vr: body.has_va_vr ? 'TRUE' : 'FALSE'
        };

        if (configRow) {
            // Atualiza a linha 1
            Object.keys(payload).forEach(key => configRow.set(key, payload[key]));
            await configRow.save();
        } else {
            // Cria a primeira linha
            await sheet.addRow({ id: 1, ...payload });
        }

        return res.status(200).json({ ok: true, message: 'Configurações salvas com sucesso.' });
    } catch (err) {
        console.error('Erro em /api/configuracoes (POST):', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao salvar configurações.' });
    }
};
