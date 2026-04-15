export default async function handler(req, res) {
    try {
        const { turno = '1', cargo = '1', uf = 'br' } = req.query || {};

        const ufFormatada = String(uf).toLowerCase();

        // 1. Bloqueia cargos regionais sem UF
        if (cargo !== '1' && ufFormatada === 'br') {
            return res.status(400).json({
                erro: true,
                mensagem: 'Selecione um Estado (UF) para ver os dados deste cargo.'
            });
        }

        // 2. Define eleição
        let eleicao = '544';
        if (cargo === '1') {
            eleicao = (turno === '2') ? '545' : '544';
        } else {
            eleicao = (turno === '2') ? '547' : '546';
        }

        const cargoFormatado = String(cargo).padStart(4, '0');

        const url = `https://resultados.tse.jus.br/oficial/ele2022/${eleicao}/dados-simplificados/${ufFormatada}/${ufFormatada}-c${cargoFormatado}-e000${eleicao}-r.json`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });

        // 3. Trata 404 do TSE
        if (response.status === 404) {
            return res.status(404).json({
                erro: true,
                mensagem: turno === '2'
                    ? 'Não houve 2º turno para este cargo neste estado.'
                    : 'Dados não encontrados no TSE para esta consulta.'
            });
        }

        // 4. Se não for OK (500, 403, etc)
        if (!response.ok) {
            return res.status(502).json({
                erro: true,
                mensagem: `Erro na API do TSE (status ${response.status})`
            });
        }

        // 5. GARANTE que é JSON válido
        const contentType = response.headers.get('content-type');

        if (!contentType || !contentType.includes('application/json')) {
            return res.status(502).json({
                erro: true,
                mensagem: 'Resposta inválida do TSE (não é JSON).'
            });
        }

        let data;

        try {
            data = await response.json();
        } catch (e) {
            return res.status(502).json({
                erro: true,
                mensagem: 'Erro ao processar JSON do TSE.'
            });
        }

        // 6. Validação de dados
        if (!data?.cand || data.cand.length === 0) {
            return res.status(404).json({
                erro: true,
                mensagem: 'Nenhum candidato encontrado para este cargo/turno.'
            });
        }

        // 7. Mapeamento seguro
        let todosCandidatos = data.cand.map(c => {
            const votosNumero = parseInt(c.vap) || 0;

            return {
                sqcand: c.sqcand,
                nome: c.nm,
                partido: c.cc,
                votos: (c.pvap || '0').replace(',', '.'),
                votosNumero,
                total: votosNumero.toLocaleString('pt-BR'),
                eleito: c.e?.toLowerCase() === 's',
                segundoTurno: c.e?.toLowerCase() === '2t',
                foto: `https://resultados.tse.jus.br/oficial/ele2022/${eleicao}/fotos/${ufFormatada}/${c.sqcand}.jpeg`
            };
        });

        // 8. Ordena
        todosCandidatos.sort((a, b) => b.votosNumero - a.votosNumero);

        // 9. Resposta final
        return res.status(200).json({
            turno,
            percurso: data.pst || "0,00",
            atualizacao: (data.dg && data.hg)
                ? `${data.dg} às ${data.hg}`
                : 'Sem dados de hora',
            resumo: {
                validos: data.vv ? parseInt(data.vv).toLocaleString('pt-BR') : '--',
                pctValidos: data.pvv || '0,00',
                brancos: data.vb ? parseInt(data.vb).toLocaleString('pt-BR') : '--',
                pctBrancos: data.pvb || '0,00',
                nulos: data.tvn ? parseInt(data.tvn).toLocaleString('pt-BR') : '--',
                pctNulos: data.ptvn || '0,00',
                abstencoes: data.a ? parseInt(data.a).toLocaleString('pt-BR') : '--',
                pctAbstencoes: data.pa || '0,00'
            },
            candidatos: todosCandidatos
        });

    } catch (err) {
        console.error('Erro real de conexão:', err);

        return res.status(500).json({
            erro: true,
            mensagem: 'Erro interno no servidor.',
            detalhe: err.message
        });
    }
}