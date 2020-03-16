// +------------------------------------------------------------------------------------------------
// [ TyJS.js ] 实现 js 文件的模块化加载
// +------------------------------------------------------------------------------------------------
// | Version	1.0
// | By			春哥 <hi@chun.ge>
// | Create 	2019.07.17
// | Update		2020.03.16
// +------------------------------------------------------------------------------------------------
// 310
"use strict";
(function(w) {
	var cfg		= {
			mods: 		[],					// 公共模块，每次都加载
			debug: 		false,
			suffix: 	'.min.js',
		},
		env	= {
			loading:	[],
			app: 		{},
			mods:	 	{},	// { n:'', s:0, d:[], i:[], f:function(){} }
							// s: 0 - 等待加载
							// 	  1 - 加载中
							// 	  2 - 加载完毕
							// 	  3 - 回调函数可执行
							// 	  4 - 回调函数执行完毕
		},
		ty = function() {
			this.v	= '1.0',			// 版本号
			this.t	= '20200316';		// 最后修订时间
		};

	/**
	 * 加载 js文件
	 * : 利用 { script标签注入 and async加载属性 } 实现并行加载
	 * : 脚本加载成功后移除临时生成的script标签
	 * @param  {s|a} n 需要加载的js文件名
	 * @return {bool}  标签注入成功
	 */
	function jsA(n)
	{
		// 检测是否已添加过
		if(env.mods[n]) return true;

    	// 未添加过
    	env.mods[n] = {n:n, s:0, i:[]};	// 记录
		var url, js = document.createElement("script");
		
		js.name 	= n,
		js.id		= n,
		js.async	= true, 	// {true:异步|false:同步}	// 加载完成后自动执行脚本
		js.type		= 'text/javascript';

		// 文件路径
		if(cfg.paths[n]) {
			url = cfg.paths[n].replace(/^[a-zA-Z]+:/, function(v) {
				return ('http:'==v|'https:'==v) ? v : cfg.alias[v.replace(/:$/,'')];
			});
		} else {
			url = cfg.base + n + cfg.suffix;
		}
		js.src = url;
		
		// 加载失败时的调用函数
		// : 须采用匿名函数形式
		js.onerror = function() {
			// 移除节点
			jsR(n);
		};
		js.onload = function() {
			// 移除节点
			jsR(n);
			env.mods[n].s = 4;
		}
		
		// 添加n.js
		document.head.appendChild(js);
		env.loading.push(n);	// 
		env.mods[n]['s'] = 1;	// 更改模块状态：加载中
	}

	/**
	 * 移除临时生成的 Script 节点
	 * @param  {str}	n 	节点name
	 */
	function jsR(n)
	{
		env.loading.splice(env.loading.indexOf(n), 1);
		document.head.removeChild(document.getElementById(n));
	}

    /**
     * 执行模块的回调函数
     * @param  {str} m 	模块名
     */
    function exec(n)
    {
    	if(4>env.mods[n].s) {
			// 回调函数未执行
			var d = env.mods[n].d, df = [];

			for(var i in d) {
				df.push(ty[d[i]]);
			}

			w.ty[n] = env.mods[n].f.apply(n, df); // 执行模块的回调函数

			env.mods[n].f = null,
			env.mods[n].s = 4;
		}

		// 排查部分下级模块：在执行回调函数前添加的
		var i = env.mods[n]['i'];
		for(var j in i) {
			if(4>env.mods[i[j]].s) {
				exec(i[j]);
			}
		}
    }

    /**
	 * 当前正在执行的js文件所在标签name属性值
	 * @return {str} name属性值
	 */
	function jsN()
	{
		return document.currentScript.name;
	}

    /**
     * 检测循环依赖
     * @param  {string}		n 	正在检测的模块名
     * @param  {str|arr}	d 	此模块的依赖模块组
     * @return {bool}		  	返回结果{true|false}
     */
    function isLoop(n, d)
    {
    	var e;
    	// 排查依赖模块组
    	for(var i in d) {
    		// 提取单个依赖模块信息
    		e = env.mods[d[i]];

    		// 模块e加载完毕
    		// 未加载完毕的模块不知道其依赖模块
    		if(e && e.s>1) {
    			// 检测模块与{其依赖模块|多级依赖模块}重名 即循环依赖
    			// e.d.length != 0 表示{模块e无依赖模块}
    			if(e.n==n || e.d.length && isLoop(n, e.d)) {
    				return true;
    			}
    		}
    	}
    	return false;
    }

    /**
     * 合并两个 json
     * : 重合项以第2个为准
     * @param  {json} o 第1个
     * @param  {json} j 第2个
     * @return {json}   结果
     */
    function mix(o, j)
    {
    	for(var k in j) {
			if(null==o[k]) {
				// 赋值
				o[k] = j[k];
				continue;
			}
			// 整合
			if('object' === typeof j[k] && !j[k].length) {
				// 合并
				o[k] = mix(o[k], j[k]);
			} else if('undefine' !== typeof j[k] || 'symbol' !== typeof j[k]) {
				// 替换
				o[k] = j[k];
			}
		}
		return o;
    }

	/**
	 * 设置全局参数
	 * : 重合项以 opts 的参数为准
	 * @param {json} opts 新参数
	 */
	ty.prototype.set = function(opts)
	{
		opts = opts || {};
		// 合并
		cfg = mix(cfg, opts);
	};

	// 创建新模块
	w.define = function(d, f='')
	{
		// 获取当前模块名
		var n = jsN();
		
		env.mods[n]['s'] = 2;	// 更改模块状态：加载完毕
		// loading 数组中减去这个模块名 // 将其归到加载完成数组中
		env.loading.splice(env.loading.indexOf(n), 1);
		
		// 调理参数
		if(''==d || null==d) {
			d = []
		} else if('string' == typeof d) {
			d = d.replace(/\s+/g, '').split(',');
		} else if('function' == typeof d) {
			f = d,
			d = []
		}
		
		// 检测：仅在调试状态下生效
		if(cfg.debug) {
			// 检测参数 f
			if('function'!=typeof f) {
				throw new Error('define()的参数2应当是函数，请检查后重试！');
			}
			// 循环依赖
			if( isLoop(n, d) ) {
				throw new Error(n + "模块与之前的模块存在循环依赖");
			}
		}

		env.mods[n]['d'] = d,
		env.mods[n]['f'] = f,
		env.mods[n]['s'] = 3;	// 更改模块状态：回调函数可执行
		
		// 排查其依赖模块
		for(var i in d) {
			jsA(d[i]);
			if(4>env.mods[d[i]]['s']) {
				env.mods[n]['s'] = 2;
				env.mods[d[i]]['i'].push(n);
			}
		}

		if(3===env.mods[n]['s']) {
			// 当前模块的回调函数可执行
			exec(n);
		}
	};

	// 定义函数
	w.require = function(d, f='')
	{
		var z = 1;		// 立即执行{1|0}
		
		// 调理参数
		if('string'===typeof d) {
			d = d.replace(/\s+/g, '').split(',');
		} else if('function'===typeof d) {
			f = d, d = [];
		}
		// ''==d || null==d || []==d
		// ''==[]
		if([]==d || null==d) {
			d = [];
		}

		if(''==f || null==f) {
			f = function(){};
		}

		if(cfg.debug && 'function'!=typeof f) {
			throw new Error('require()的参数2应当是函数，请检查后重试！');
		}

		// 排查依赖模块组
		for(var i in d) {
			jsA(d[i]);
			if(4>env.mods[d[i]].s) {
				 z = 0;
			}
		}

		if(z) {
			// 立即执行
			return f;
		}
		
		// 以当前时间作为键值
		var k = new Date().getTime();
		env.app[k] = {d:d, f:f, s:0};		// s{0|1}

		return function() {
			if(env.app[k].s) {
				env.app[k].f();
			} else {
				var z = 1;
				for(var i in env.app[k].d) {
					if(4>env.mods[d[i]].s) {
						 z = 0;
					}
				}
				if(z) {
					env.app[k].s = 1;
					env.app[k].f();
				} else {
					console.log('函数的依赖模块未加载完毕');
				}
				
			}
		};
	};
	
	w.ty = new ty();
})(window);