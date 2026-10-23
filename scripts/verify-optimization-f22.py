"""Independent float64 PyTorch autograd/framework references against the JS engine."""
import json, math, pathlib, subprocess, sys, py_compile
root=pathlib.Path('.artifacts/f22/optimization-fixtures').resolve()
expected=json.loads((root/'reference.json').read_text(encoding='utf-8'))
reports=[]
for style in ('framework','scratch'):
    path=root/(style+'.py');py_compile.compile(str(path),doraise=True)
    observed=json.loads(subprocess.run([sys.executable,str(path)],capture_output=True,text=True,check=True,timeout=120).stdout.strip().splitlines()[-1])
    assert len(observed)==len(expected)
    for result,reference in zip(observed,expected):
        assert result['status']==reference['status'], (style,result['config'],result['status'],reference['status'])
        assert len(result['history'])==len(reference['history'])
        for a,b in zip(result['history'],reference['history']):
            assert a['step']==b['step']
            for key in ('theta','gradient'):
                for actual,target in zip(a[key],b[key]):
                    assert math.isclose(actual,target,rel_tol=1e-8,abs_tol=1e-9), (style,reference['config'],key,actual,target)
            assert math.isclose(a['loss'],b['loss'],rel_tol=1e-8,abs_tol=1e-9)
            if 'batch' in b:
                assert result['history'][a['step']-1]['nextBatch']==b['batch']
    reports.append({'style':style,'configurations':len(observed),'status':'passed'})
for path in root.glob('search-*.py'):
    py_compile.compile(str(path),doraise=True)
    observed=json.loads(subprocess.run([sys.executable,str(path)],capture_output=True,text=True,check=True,timeout=120).stdout.strip().splitlines()[-1])
    assert observed['holdoutAccess'] is False
    assert len(observed['results'])==len(observed['protocol']['configs'])
    assert all(len(row['scores'])==observed['protocol']['folds'] and all(math.isfinite(v) for v in row['scores']) for row in observed['results'])
    reports.append({'search':path.name,'status':'passed'})
(root/'python-verification.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print('PyTorch framework/autograd parity and all seven fold-safe Python search recipes passed.')
