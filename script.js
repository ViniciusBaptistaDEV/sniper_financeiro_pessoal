const app = {
    state: {
        token: sessionStorage.getItem('sniper_pessoal_token'),
        currentMonth: new Date().toISOString().slice(0, 7),
        contasFixas: [],
        lancamentosCache: []
    },

    init() {
        const monthInput = document.getElementById('month-filter');
        if (monthInput) monthInput.value = this.state.currentMonth;

        if (this.state.token) {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            this.loadDashboard();
        }
    },

    /* ========== AUTH ========== */
    async login() {
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        const loginBtn = document.getElementById('login-btn');

        const originalBtnHTML = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner"></span> Verificando...';

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, pass })
            });

            if (res.ok) {
                const { token } = await res.json();
                sessionStorage.setItem('sniper_pessoal_token', token);
                window.location.reload();
            } else {
                this.openModal('acesso-negado');
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalBtnHTML;
            }
        } catch (err) {
            this.toast('Erro na conexão com o servidor', 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnHTML;
        }
    },

    logout() {
        sessionStorage.removeItem('sniper_pessoal_token');
        window.location.reload();
    },

    /* ========== HELPERS ========== */
    brl(v) {
        return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    toast(msg, type = 'success') {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.className = 'toast toast-' + type;
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => el.classList.add('hidden'), 3000);
    },

    async api(path, options = {}) {
        const res = await fetch(path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.state.token,
                ...(options.headers || {})
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`);
        return data;
    },
    /* ========== MODAIS ========== */
    openModal(tipo) {
        const modal = document.getElementById('modal-' + tipo);
        if (!modal) return;

        const today = new Date().toISOString().slice(0, 10);
        modal.querySelectorAll('input[type="date"]').forEach(i => { if (!i.value) i.value = today; });
        modal.querySelectorAll('input[type="month"]').forEach(i => { if (!i.value) i.value = this.state.currentMonth; });

        if (tipo === 'pagar_conta_fixa') {
            this.popularSelectContasFixas();
            document.getElementById('pagar-info')?.classList.add('hidden');
            const v = document.getElementById('pagar-valor'); if (v) v.value = '';
        }

        modal.classList.remove('hidden');
    },

    closeModal(tipo) {
        document.getElementById('modal-' + tipo)?.classList.add('hidden');
    },

    toggleParcelas() {
        const tipo = document.getElementById('conta-tipo').value;
        const field = document.getElementById('parcelas-field');
        field.classList.toggle('hidden', tipo !== 'parcelada');
    },

    /* ========== CONTAS FIXAS (cruzamento por ID) ========== */
    async popularSelectContasFixas() {
        const select = document.getElementById('pagar-conta-fixa-id');
        select.innerHTML = '<option value="">Carregando...</option>';

        try {
            const { contasFixas } = await this.api('/api/contas-fixas');
            this.state.contasFixas = contasFixas;

            if (!contasFixas.length) {
                select.innerHTML = '<option value="">Nenhuma conta fixa cadastrada</option>';
                return;
            }

            select.innerHTML = '<option value="">Selecione uma conta fixa...</option>';
            contasFixas.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;                                                  // ⬅️ value = id
                opt.textContent = `${c.descricao} • Venc. dia ${c.dia_vencimento} • ${this.brl(c.valor_estimado)}`;
                opt.dataset.conta = JSON.stringify(c);
                select.appendChild(opt);
            });

            select.onchange = () => {
                const opt = select.options[select.selectedIndex];
                const info = document.getElementById('pagar-info');
                const valor = document.getElementById('pagar-valor');
                if (!opt || !opt.dataset.conta) {
                    info.classList.add('hidden'); info.innerHTML = '';
                    if (valor) valor.value = '';
                    return;
                }
                const c = JSON.parse(opt.dataset.conta);
                info.classList.remove('hidden');
                info.innerHTML = `
                    <div><b>Tipo:</b> ${c.tipo || 'infinita'}${c.total_parcelas ? ` (${c.total_parcelas}x)` : ''}</div>
                    <div><b>Valor estimado:</b> ${this.brl(c.valor_estimado)}</div>
                    <div><b>Vence todo dia:</b> ${c.dia_vencimento}</div>
                    ${c.observacao ? `<div><b>Obs:</b> ${c.observacao}</div>` : ''}
                `;
                if (valor) valor.value = Number(c.valor_estimado).toFixed(2);
            };
        } catch (err) {
            select.innerHTML = '<option value="">Erro ao carregar contas fixas</option>';
            this.toast('Erro ao carregar contas fixas', 'error');
        }
    },

    /* ========== SUBMIT DE FORMULÁRIOS ========== */
    async submitForm(e, endpoint) {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());

        ['valor', 'valor_estimado', 'total_parcelas', 'dia_vencimento', 'dia_cobranca']
            .forEach(k => { if (data[k]) data[k] = Number(data[k]); });

        if (endpoint === 'conta-fixa' && !data.conta_fixa_id) {
            this.toast('Selecione uma conta fixa!', 'error');
            return;
        }

        // Mapeia endpoint -> modal-id para fechar o modal correto
        const closeMap = {
            'gasto-diario': 'gasto',
            'receita': 'receita',
            'nova-conta-fixa': 'conta_fixa',
            'conta-fixa': 'pagar_conta_fixa',
            'informativo': 'informativo'
        };

        try {
            await this.api('/api/' + endpoint, { method: 'POST', body: JSON.stringify(data) });
            this.toast('Salvo com sucesso!', 'success');
            form.reset();
            this.closeModal(closeMap[endpoint]);
            await this.loadDashboard();
        } catch (err) {
            this.toast('Erro ao salvar: ' + err.message, 'error');
        }
    },

    /* ========== DASHBOARD ========== */
    async loadDashboard() {
        const month = document.getElementById('month-filter')?.value || this.state.currentMonth;
        this.state.currentMonth = month;

        try {
            const [resContas, resInformativos, resLancamentos] = await Promise.all([
                this.api('/api/contas-fixas'),
                this.api('/api/informativos'),
                this.api('/api/lancamentos?mes=' + month)
            ]);

            const contasFixas = Array.isArray(resContas?.contasFixas) ? resContas.contasFixas : [];
            const informativos = Array.isArray(resInformativos?.informativos) ? resInformativos.informativos : [];
            const lancamentos  = Array.isArray(resLancamentos?.lancamentos)  ? resLancamentos.lancamentos  : [];

            this.state.contasFixas = contasFixas;
            this.state.lancamentosCache = lancamentos;

            // ⬇️ Índice por ID para cruzamento O(1)
            const contaById = Object.fromEntries(contasFixas.map(c => [String(c.id), c]));

            let totalReceitas = 0, totalGastos = 0, totalContasPagas = 0;
            lancamentos.forEach(l => {
                const v = Number(l.valor) || 0;
                if (l.tipo === 'receita') totalReceitas += v;
                else if (l.tipo === 'gasto_diario') totalGastos += v;
                else if (l.tipo === 'conta_fixa') totalContasPagas += v;
            });

            document.getElementById('sum-receitas').textContent = this.brl(totalReceitas);
            document.getElementById('sum-gastos').textContent   = this.brl(totalGastos);
            document.getElementById('sum-contas').textContent   = this.brl(totalContasPagas);
            document.getElementById('sum-saldo').textContent    = this.brl(totalReceitas - totalGastos - totalContasPagas);

            this.renderContasFixas(contasFixas, lancamentos.filter(l => l.tipo === 'conta_fixa'), contaById);
            this.renderInformativos(Array.isArray(informativos) ? informativos : []);
            this.renderLancamentos(lancamentos, contaById);
        } catch (err) {
            this.toast('Erro ao carregar dashboard: ' + err.message, 'error');
        }
    },

    renderContasFixas(contasFixas, pagamentos, contaById) {
        const el = document.getElementById('contas-fixas-list');
        if (!contasFixas.length) {
            el.innerHTML = '<p class="empty-msg">Nenhuma conta fixa cadastrada.</p>';
            return;
        }
        const hoje = new Date();
        el.innerHTML = contasFixas.map(c => {
            const pago = pagamentos.find(p => String(p.conta_fixa_id) === String(c.id));
            const venc = new Date(hoje.getFullYear(), hoje.getMonth(), c.dia_vencimento);
            const status = pago
                ? '<span class="badge badge-green">Paga</span>'
                : (venc < hoje ? '<span class="badge badge-yellow">Atrasada</span>'
                              : '<span class="badge badge-gray">Pendente</span>');
            return `
                <div class="item-card">
                    <div class="item-title">
                        <span>${c.descricao}</span>
                        ${status}
                    </div>
                    <div class="item-meta">
                        <span>Dia ${c.dia_vencimento}</span>
                        <span>${c.tipo || 'infinita'}${c.total_parcelas ? ` • ${c.total_parcelas}x` : ''}</span>
                    </div>
                    <div class="item-value txt-orange">${this.brl(c.valor_estimado)}</div>
                    ${pago ? `<div class="item-meta"><span>Pago em ${pago.data_realizado} • ${this.brl(pago.valor)}</span></div>` : ''}
                </div>`;
        }).join('');
    },

    renderInformativos(list) {
        const el = document.getElementById('informativos-list');
        if (!list.length) {
            el.innerHTML = '<p class="empty-msg">Nenhum informativo cadastrado.</p>';
            return;
        }
        el.innerHTML = list.map(i => `
            <div class="item-card">
                <div class="item-title">
                    <span>${i.servico}</span>
                    <span class="badge badge-blue">${i.modalidade || 'Mensal'}</span>
                </div>
                <div class="item-meta">
                    <span>Cobra dia ${i.dia_cobranca}</span>
                    ${i.cartao_destino ? `<span>${i.cartao_destino}</span>` : ''}
                </div>
                ${i.observacao ? `<div class="item-meta"><span>${i.observacao}</span></div>` : ''}
            </div>`).join('');
    },

    renderLancamentos(list, contaById) {
        const el = document.getElementById('lancamentos-list');
        if (!list.length) {
            el.innerHTML = '<p class="empty-msg">Nenhum lançamento neste mês.</p>';
            return;
        }
        el.innerHTML = list.map(l => {
            let descricao = l.descricao;
            let badge = '';
            if (l.tipo === 'conta_fixa' && l.conta_fixa_id) {
                const conta = contaById[String(l.conta_fixa_id)];
                descricao = conta ? conta.descricao : `(Conta #${l.conta_fixa_id} removida)`;
                badge = '<span class="badge badge-orange">Conta Fixa</span>';
            } else if (l.tipo === 'receita') {
                badge = '<span class="badge badge-green">Receita</span>';
            } else {
                badge = '<span class="badge badge-purple">Gasto</span>';
            }
            return `
                <div class="item-card">
                    <div class="item-title">
                        <span>${descricao}</span>
                        ${badge}
                    </div>
                    <div class="item-meta">
                        <span>${l.data_realizado}</span>
                        ${l.forma_pagamento ? `<span>${l.forma_pagamento}</span>` : ''}
                    </div>
                    <div class="item-value ${l.tipo === 'receita' ? 'txt-green' : l.tipo === 'conta_fixa' ? 'txt-orange' : 'txt-purple'}">
                        ${l.tipo === 'receita' ? '+' : '-'} ${this.brl(l.valor)}
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px; justify-content: flex-end; border-top: 1px solid #2a2a2e; padding-top: 10px;">
                        <button style="background: transparent; border: 1px solid #00ffff; color: #00ffff; border-radius: 4px; padding: 5px 12px; cursor: pointer; font-size: 0.8rem; box-shadow: 0 0 8px rgba(0,255,255,0.2); transition: all 0.2s ease;" onclick="app.abrirModalEdicao('${l.id}')">✏️ Editar</button>
                        <button style="background: transparent; border: 1px solid #ff4d4d; color: #ff4d4d; border-radius: 4px; padding: 5px 12px; cursor: pointer; font-size: 0.8rem; box-shadow: 0 0 8px rgba(255,77,77,0.2); transition: all 0.2s ease;" onclick="app.abrirModalExclusao('${l.id}')">🗑 Excluir</button>
                    </div>
                </div>`;
        }).join('');
    },

    /* ========== FUNÇÕES DE EDITAR E EXCLUIR ========== */
    abrirModalExclusao(id) {
        const item = this.state.lancamentosCache.find(l => String(l.id) === String(id));
        if (!item) return;

        this.state.lancamentoIdExclusao = id;

        let desc = item.descricao;
        if (item.tipo === 'conta_fixa' && item.conta_fixa_id) {
            const conta = this.state.contasFixas.find(c => String(c.id) === String(item.conta_fixa_id));
            if (conta) desc = conta.descricao;
        }

        const previewEl = document.getElementById('delete-item-preview');
        if (previewEl) {
            previewEl.innerHTML = `
                <div style="background:#1d1d20; padding:12px; border-radius:8px; border:1px solid #ff4d4d33; margin-top:10px; color: #fff;">
                    <strong>${desc}</strong><br>
                    <span style="color: #ff4d4d;">Valor: ${this.brl(item.valor)}</span><br>
                    <span style="font-size: 0.85rem; color: #aaa;">Data: ${item.data_realizado}</span>
                </div>`;
        }

        this.openModal('confirmar-exclusao');
    },

    async confirmarExclusao() {
        const id = this.state.lancamentoIdExclusao;
        if (!id) return;

        const btn = document.getElementById('btn-confirmar-exclusao');
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = 'Excluindo...';
        btn.disabled = true;

        try {
            await this.api('/api/lancamento-delete', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });

            this.toast('Lançamento excluído com sucesso!', 'success');
            this.closeModal('confirmar-exclusao');
            this.loadDashboard();
        } catch (err) {
            this.toast('Erro ao excluir: ' + err.message, 'error');
        } finally {
            btn.innerHTML = txtOriginal;
            btn.disabled = false;
        }
    },

    abrirModalEdicao(id) {
        const item = this.state.lancamentosCache.find(l => String(l.id) === String(id));
        if (!item) return;

        document.getElementById('edit-lancamento-id').value = item.id;

        let desc = item.descricao;
        if (item.tipo === 'conta_fixa' && item.conta_fixa_id) {
            const conta = this.state.contasFixas.find(c => String(c.id) === String(item.conta_fixa_id));
            if (conta) desc = conta.descricao;
            document.getElementById('edit-descricao').readOnly = true; 
        } else {
            document.getElementById('edit-descricao').readOnly = false;
        }

        document.getElementById('edit-descricao').value = desc || '';
        document.getElementById('edit-valor').value = Number(item.valor).toFixed(2);
        document.getElementById('edit-data-realizado').value = item.data_realizado || '';
        document.getElementById('edit-data-competencia').value = item.data_competencia || '';
        document.getElementById('edit-forma-pagamento').value = item.forma_pagamento || '';
        document.getElementById('edit-observacao').value = item.observacao || '';

        this.openModal('editar-lancamento');
    },

    async submitEditarLancamento(e) {
        e.preventDefault();
        const id = document.getElementById('edit-lancamento-id').value;
        const itemOriginal = this.state.lancamentosCache.find(l => String(l.id) === String(id));

        const payload = {
            id: id,
            descricao: document.getElementById('edit-descricao').value,
            valor: Number(document.getElementById('edit-valor').value),
            data_realizado: document.getElementById('edit-data-realizado').value,
            data_competencia: document.getElementById('edit-data-competencia').value,
            forma_pagamento: document.getElementById('edit-forma-pagamento').value,
            observacao: document.getElementById('edit-observacao').value
        };

        if (itemOriginal) {
            payload.tipo = itemOriginal.tipo;
            if (itemOriginal.conta_fixa_id) {
                payload.conta_fixa_id = itemOriginal.conta_fixa_id;
            }
        }

        try {
            await this.api('/api/lancamento-update', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            this.toast('Lançamento atualizado com sucesso!', 'success');
            this.closeModal('editar-lancamento');
            this.loadDashboard();
        } catch (err) {
            this.toast('Erro ao editar: ' + err.message, 'error');
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}