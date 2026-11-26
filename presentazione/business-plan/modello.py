# Business plan JobExpress — ipotesi dichiarate e modificabili. Tutti i prezzi IVA 22% inclusa.
import json
IVA=1.22
PREZZI={'plus_m':4.99,'plus_a':39.99,'fr_m':9.99,'fr_a':79.99}
# mix degli account paganti (un gruppo Friends = 3 account)
MIX={'plus_m':0.45,'plus_a':0.25,'fr_m':0.20,'fr_a':0.10}
mensile={'plus_m':4.99,'plus_a':39.99/12,'fr_m':9.99/3,'fr_a':79.99/36}  # incasso medio per account al mese, IVA inclusa
arpa_lordo=sum(MIX[k]*mensile[k] for k in MIX)
arpa_netto_iva=arpa_lordo/IVA
# commissioni pagamento: ipotesi 1,5% + 0,25 € per addebito; addebiti per account al mese
addebiti={'plus_m':1,'plus_a':1/12,'fr_m':1/3,'fr_a':1/36}
comm=sum(MIX[k]*(mensile[k]*0.015+0.25*addebiti[k]) for k in MIX)
arpa=arpa_netto_iva-comm
SCEN={
 'Prudente':  {'utenti':[0,1500,4000,8000],  'conv':0.02, 'mkt':150, 'tech':[40,60,120]},
 'Intermedio':{'utenti':[0,3000,10000,25000],'conv':0.035,'mkt':400, 'tech':[40,90,220]},
 'Espansivo': {'utenti':[0,6000,25000,70000],'conv':0.05, 'mkt':1200,'tech':[60,150,450]},
}
FISSI={'commercialista':150,'assicurazione_rc':40,'dominio_email':10,'assistenza_strumenti':20}
LEGALE_ANNO=[3000,1000,1000]  # parere iniziale + aggiornamenti
out={'ipotesi':{'iva':IVA,'prezzi':PREZZI,'mix':MIX,'incasso_medio_account_mese_ivato':round(arpa_lordo,3),'netto_iva':round(arpa_netto_iva,3),'commissioni_pagamento_mese':round(comm,3),'ricavo_netto_account_mese':round(arpa,3),'fissi_mese':FISSI,'legale_anno':LEGALE_ANNO},'scenari':{}}
for n,s in SCEN.items():
    righe=[];cum=0;pareggio=None
    for m in range(1,37):
        a=(m-1)//12; f=((m-1)%12+1)/12
        u=s['utenti'][a]+(s['utenti'][a+1]-s['utenti'][a])*f
        pag=u*s['conv']
        incasso=pag*arpa_lordo
        ricavo=pag*arpa  # netto IVA e commissioni
        costi=s['tech'][a]+s['mkt']+sum(FISSI.values())+LEGALE_ANNO[a]/12
        utile=ricavo-costi; cum+=utile
        if pareggio is None and utile>=0: pareggio=m
        righe.append(dict(mese=m,utenti=round(u),paganti=round(pag),incasso=round(incasso),ricavo=round(ricavo),costi=round(costi),utile=round(utile),cumulato=round(cum)))
    sintesi={k:{x:righe[k-1][x] for x in ['utenti','paganti','incasso','ricavo','costi','utile','cumulato']} for k in (12,24,36)}
    annui={y:{'incasso':sum(r['incasso'] for r in righe[(y-1)*12:y*12]),'ricavo':sum(r['ricavo'] for r in righe[(y-1)*12:y*12]),'costi':sum(r['costi'] for r in righe[(y-1)*12:y*12])} for y in (1,2,3)}
    for y in annui: annui[y]['utile']=annui[y]['ricavo']-annui[y]['costi']
    out['scenari'][n]={'ipotesi':s,'mese_pareggio_mensile':pareggio,'paganti_per_pareggio_anno1':round((s['tech'][0]+s['mkt']+sum(FISSI.values())+LEGALE_ANNO[0]/12)/arpa),'mesi':sintesi,'anni':annui,'righe':righe}
json.dump(out,open('/home/claude/bp/risultati.json','w'),indent=1,ensure_ascii=False)
print('incasso medio/account/mese IVA incl.',round(arpa_lordo,2),'| netto IVA',round(arpa_netto_iva,2),'| commissioni',round(comm,3),'| ricavo netto',round(arpa,2))
for n,v in out['scenari'].items():
    print(n,'pareggio mese',v['mese_pareggio_mensile'],'| paganti per pareggio anno1',v['paganti_per_pareggio_anno1'])
    for k,x in v['mesi'].items(): print('  M',k,x)
    for y,x in v['anni'].items(): print('  anno',y,{a:round(b) for a,b in x.items()})
