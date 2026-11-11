import './CmsAnalytics.css'

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0)
}

function Metric({ label, value, detail }) {
  return (
    <article className="cms-analytics-metric">
      <span>{label}</span>
      <strong>{value == null ? '—' : formatNumber(value)}</strong>
      <small>{detail}</small>
    </article>
  )
}

export function CmsAnalytics({ data }) {
  return (
    <section className="cms-analytics" aria-labelledby="cms-analytics-title">
      <div className="cms-analytics-heading">
        <div>
          <p className="cms-eyebrow">DESEMPENHO DO PORTFÓLIO</p>
          <h2 id="cms-analytics-title">Seu público, em números<span>.</span></h2>
          <p>Entenda como as pessoas chegam e exploram seu trabalho.</p>
        </div>
        {data?.realtime?.status === 'ok' && <span className="cms-analytics-live"><i /> AO VIVO</span>}
      </div>
      {!data ? (
        <p className="cms-analytics-state">Carregando dados de acesso…</p>
      ) : data.status === 'not_configured' ? (
        <p className="cms-analytics-state">A conexão com o Google Analytics ainda não está configurada no servidor.</p>
      ) : data.status !== 'ok' ? (
        <p className="cms-analytics-state">Não foi possível consultar o Google Analytics agora. Os dados do seu acervo continuam disponíveis normalmente.</p>
      ) : (
        <>
          <div className="cms-analytics-grid">
            <Metric label="Pessoas agora" value={data.realtime?.status === 'ok' ? data.realtime.active_users : null} detail="Ativas nos últimos 30 minutos" />
            <Metric label="Público" value={data.historical?.metrics?.active_users} detail="Usuários · últimos 28 dias" />
            <Metric label="Visitas" value={data.historical?.metrics?.sessions} detail="Sessões · últimos 28 dias" />
            <Metric label="Visualizações" value={data.historical?.metrics?.page_views} detail="Páginas · últimos 28 dias" />
          </div>
          {data.historical?.status === 'ok' && (
            <p className="cms-analytics-footnote">O site registrou {formatNumber(data.historical.metrics.events)} eventos no período. Os relatórios são atualizados automaticamente.</p>
          )}
          {data.historical?.status === 'no_data' && (
            <p className="cms-analytics-footnote">O GA4 ainda está processando os primeiros relatórios históricos.</p>
          )}
        </>
      )}
    </section>
  )
}
