import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountApprovals from './AccountApprovals';

const mocks=vi.hoisted(()=>({rpc:vi.fn(),refetch:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'admin'},loading:false})}));
vi.mock('@/hooks/useAccountAccess',()=>({useAccountAccess:()=>({data:{is_admin:true}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc}}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:[{user_id:'applicant',nome:'Applicant',email:'applicant@example.invalid',status:'pending',created_at:'2026-11-14T17:00:00Z'}],refetch:mocks.refetch})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});

it('moves focus into the confirmation before approving and closes after success',async()=>{
 mocks.rpc.mockResolvedValue({error:null});
 render(<MemoryRouter><AccountApprovals/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Aprovar'}));
 const dialog=screen.getByRole('alertdialog',{name:'Aprovar o cadastro?'});
 await waitFor(()=>expect(dialog.contains(document.activeElement)).toBe(true));
 expect(mocks.rpc).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirmar aprovação'}));
 await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
 expect(mocks.rpc).toHaveBeenCalledWith('decide_account_approval',{target:'applicant',decision:'approved'});
});

it('announces a failure inside the confirmation and allows retry',async()=>{
 mocks.rpc.mockRejectedValue(new Error('Conexão indisponível'));
 render(<MemoryRouter><AccountApprovals/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Aprovar'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirmar aprovação'}));
 expect((await screen.findByRole('alert')).textContent).toContain('Conexão indisponível');
 await waitFor(()=>expect((screen.getByRole('button',{name:'Confirmar aprovação'}) as HTMLButtonElement).disabled).toBe(false));
 expect(screen.getByRole('alertdialog')).toBeTruthy();
});
