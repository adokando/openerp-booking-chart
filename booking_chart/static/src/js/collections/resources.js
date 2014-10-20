openerp.unleashed.module('booking_chart', function(booking, _, Backbone, base){
    
    var Overlap = booking.collections('Overlap'),
        Resource = booking.models('Resource'),
        _super = Overlap.prototype;
    

    var Period = base.models('Period'),
	    _superPeriod = Period.prototype;

    var GroupPeriod = Period.extend({

	    initialize: function(data, options){
		    this.daterange = options.period;
			return _superPeriod.initialize.apply(this, arguments);
	    },

	    // TODO: width for overlap model (group that has overlapped models)
		duration: function(){
			if(this.daterange.get('base') == 'hours'){
				return this.get('range').count('minutes');
			}
			return _superPeriod.duration.apply(this, arguments);
		},

	    /*
	    * TODO:
	    * generate overlapped resource models width displayed on the graph
	    * -> called by the view template
	    * */
	    toogleBarWidth: function(){
		    if(this.daterange.get('base') === 'hours'){
				return this.duration() * (1 / 15);
		    }
		    return this.duration();
	    },

	    /*
	    * TODO:
	    * used to generate format for moment object displayed
	    * on the tooltip of graph view.
	    * */
	    tooltipDateTimeFormat: function(){
			if(this.daterange.get('base') === 'hours'){
				return 'ddd. (Do MMM, YYYY) HH:mm:ss';
			}
		    return 'ddd. Do MMM, YYYY';
	    },

	    /*
	    * TODO:
	    * used to generate time indicator displayed on the tooltip
	    * possible option would be between
	    *   - Day (for months booking chart)
	    *   - Minute (for Hours booking chart)
	    * */
	    tooltipTimeIndicator: function(){
			if(this.daterange.get('base') === 'hours'){
				return 'minute';
			}
		    return 'day';
	    }
	});

    var Group = Overlap.extend({

	    period_model: GroupPeriod,
        
        label: function(){
            var title = [];
            this.each(function(model){
                title.push(model.get("name"));
            });
            return title.join(', ');
        },
        
        tags: function(){
            var tags = [];
            this.each(function(model){
                tags = _(tags).union(model.get('tags') || []);
            });
            return tags;
        },
        
        resource_id: function(){
        	var resource = this.resource_ref.split(',');
        	return resource.length == 2 ? parseInt(resource[1]) : null; 
        }
    });


    var Resources = Overlap.extend({

        collection_group: Group,
	    period_model: GroupPeriod,

        model: Resource,
        model_name: 'booking.resource',
        
        item_ids: [],
        
        initialize: function(models, options){
            _super.initialize.apply(this, arguments);
        
            this.daterange = options.period;
            this.chart = options.chart;
            this.items = options.items;
            
            this.bind();
        },
        
        bind: function(){
        	this.listenTo(this.daterange, 'change:added_start change:added_end reset', this.fetch);
            this.listenTo(this.items, 'sync', this.loadPage);
            this.listenTo(this.items, 'group:sync', this.loadGroup);
            this.listenTo(this, 'invalid', this.modelError);
            this.listenTo(this, 'reset sync', this.updateItemsHeight);
        },
        
        unbind: function(){
            this.stopListening();
        },
        
        updateItemsHeight: function(){
        	var group_by_item = {};
        
        	// each group, with max length calculation
        	this.eachAggregatedGroups(function(groups){
                var max = 0, last_group;
                
                _(groups).each(function(group){
                	max = group.length > max ? group.length : max;  
                	last_group = group;
                });
                
                // get the item, in the collection or in a group_by element if any 
                var item = this.items.getInGroup(last_group.resource_id());
                
                if(item) {
                    item.set('height', max);
                }
                
            }, this);
        },

        loadPage: function(){
            var ids = [];
            
            this.reset();
            this.daterange.addedFull();
            
            this.items.each(function(item){
                ids.push(item.model_name + ',' + item.get('id'));    
            });
            
            this.item_ids = ids;
            return this.fetch();
        },
        
        loadGroup: function(query, group){
            var ids = [];
            
            this.daterange.addedFull();
            
            group.each(function(item){
                ids.push(item.model_name + ',' + item.get('id'));    
            });
                
            this.item_ids = ids.concat(this.item_ids);
            return this.fetch();
        },

	    /*
	    * TODO:
	    * because booking.resources collection will be fetched based on 'added_start' and 'added_end'
	    * of the global period (DateRange), so when user clicks on the 'show' button, we have to manually
	    * update 'start', 'end' , 'added_start', 'added_end', also make sure that 'added_start' = 'start' and
	    * 'added_end' = 'end'.
	    **/
        search: function(){
            var period_start = this.daterange.get('added_start').format('YYYY-MM-DD'),
                period_end = this.daterange.get('added_end').format('YYYY-MM-DD');
            
            var search = {
                remove: false,
                filter: [
                    [ 'resource_ref', 'in', this.item_ids ],
                    [ 'chart_id', '=', this.chart.get('id') ],
                    '|',
                    '&', [ 'date_start', '>=',  period_start ], [ 'date_start', '<=',  period_end ],
                    '&', [ 'date_end', '>=', period_start  ], [ 'date_end', '<=', period_end ],
                ]
            };
            return search;
        },
        
        modelError: function(model, error, options){
            throw options.validationError || error;
        }
    });

    booking.collections('Resources', Resources);
});