import { describe, expect, it } from "vitest";
import { parseResultsText } from "./resultsParser";
const players = [
  { id:"team-a",nome_completo:"Cruzeirão cabuloso",nick_playroom:"reginaldovales / wender.Andrade",is_team:true,grupo:"21" },
  { id:"team-b",nome_completo:"Tropa do kakau",nick_playroom:"Hapolo / Kakau",is_team:true,grupo:"8" },
];
const teamMembers = [
  {team_id:"team-a",member_nome:"Reginaldo",member_nick:"reginaldovales"},
  {team_id:"team-a",member_nome:"Wender",member_nick:"wender.Andrade"},
  {team_id:"team-b",member_nome:"Edson",member_nick:"Hapolo"},
  {team_id:"team-b",member_nome:"Kauã",member_nick:"Kakau"},
];
const text = `16 avos, MESA 11:

18/09 14:00

Pontuações:

reginaldovales e wender.Andrade: 5600.

Hapolo e Kakau: 1800.

reginaldovales e wender.andrade ganharam a partida!`;
describe("importação de resultados de duplas", () => {
 it("reconhece o exemplo dos 16 avos com membros de grupos diferentes", () => {
  const blocks=parseResultsText(text,players,{teamMembers,requireSameGroup:false});
  expect(blocks).toHaveLength(1);
  expect(blocks[0].errors).toEqual([]);
  expect(blocks[0].players.map(p=>[p.playerId,p.pontosMesa,p.pontosJogo])).toEqual([["team-a",5600,3],["team-b",1800,0]]);
  expect(blocks[0].data).toBe("18/09");expect(blocks[0].horario).toBe("14:00");
 });
 it("mantém a validação de grupos na fase de grupos", () => {
  expect(parseResultsText(text,players,{teamMembers,requireSameGroup:true})[0].errors.join()).toContain("grupos diferentes");
 });
 it("não escolhe uma dupla quando o nome é ambíguo", () => {
  const duplicate={...players[0],id:"team-c"};
  const members=[...teamMembers,...teamMembers.filter(m=>m.team_id==='team-a').map(m=>({...m,team_id:'team-c'}))];
  const result=parseResultsText(text,[...players,duplicate],{teamMembers:members,requireSameGroup:false})[0];
  expect(result.errors.join()).toContain("Ambiguidade");
  expect(result.players.every(p=>p.playerId)).toBe(false);
 });
});
