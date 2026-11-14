"""Render messages without sending email or using real user data."""
from email.utils import parseaddr
from approval_notifier import compose as approval
from organization_invite_notifier import compose as invite

brand='Torneios Tropa do Víni';base='https://torneios.vini10.com'
row={'id':'10000000-0000-0000-0000-000000000001','user_id':'10000000-0000-0000-0000-000000000002',
     'name':'Pessoa <teste>','email':'example@example.invalid','brand':brand,'base':base}
for kind in ('pending','approved','rejected'):
    msg=approval(dict(row,kind=kind),'Torneios <comunicacoes@5serie.net>')
    assert parseaddr(str(msg['From']))==(brand,'comunicacoes@5serie.net')
    assert brand in str(msg['Subject'])
    body=msg.get_body(preferencelist=('html',)).get_content()
    assert 'Quinta Série' not in body and 'torneios.5serie.net' not in body
    if kind!='rejected':assert base in body
msg=invite(dict(row,organization_name=brand,public_base_url=base,role='member'),'Torneios <comunicacoes@5serie.net>')
assert parseaddr(str(msg['From']))==(brand,'comunicacoes@5serie.net')
assert base+'/organization-invite' in msg.get_body(preferencelist=('html',)).get_content()
fallback=approval(dict(row,kind='approved',brand=None,base=None),'Torneios <comunicacoes@5serie.net>')
assert 'https://torneios.5serie.net/auth' in fallback.get_body(preferencelist=('html',)).get_content()
print('Approval, rejection, invitation and fallback branding verified; no emails sent.')
