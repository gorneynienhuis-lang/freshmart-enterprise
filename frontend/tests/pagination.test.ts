import {describe,it,expect} from 'vitest';
import {pageNumber,paginationState} from '../src/app/pagination';
describe('real pagination boundaries',()=>{
 it('keeps pages beyond the old first100 cap reachable',()=>{const result=paginationState(6,20,137);expect(result).toMatchObject({pages:7,first:101,last:120,previous:true,next:true});expect(paginationState(7,20,137)).toMatchObject({first:121,last:137,next:false});});
 it('treats zero rows as an empty first page',()=>expect(paginationState(1,20,0)).toEqual({pages:1,previous:false,next:false,first:0,last:0}));
 it('permits valid deep links but normalizes invalid numeric query input',()=>{expect(pageNumber('6')).toBe(6);expect(pageNumber('2147483647')).toBe(2147483647);for(const value of [undefined,null,'','-1','1.5','2e3','2147483648','Infinity','NaN','<script>'])expect(pageNumber(value)).toBe(1);});
 it('rejects unsafe server pagination metadata',()=>{expect(()=>paginationState(0,20,1)).toThrow();expect(()=>paginationState(1,101,1)).toThrow();expect(()=>paginationState(1,20,Number.MAX_SAFE_INTEGER+1)).toThrow();});
});
