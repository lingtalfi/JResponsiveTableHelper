/**
 * Responsive table helper
 * ==============
 * 2019-09-02
 *
 *
 *
 * Markup & nomenclature
 * ---------
 * So there is a table, and when the user resizes the screen, the table columns re-arrange themselves
 * in such a way that it's always possible to see all the content of a given row without horizontal scrolling (which
 * is the technique bootstrap4 uses, but it's not optimal I believe).
 *
 * I first found this idea in datatables.net, but I re-implemented it my way.
 *
 * There are mainly two things going on:
 * - first some columns are hidden/shown as the table is shrunk/stretched (referred to as horizontal treatment)
 * - then a subrow is available by clicking a plus toggler whenever the table has been shrunk (referred to as vertical treatment)
 *
 *
 * ### Horizontal treatment
 *
 * The basic idea of this implementation is to hide columns which we don't want.
 * From the configuration we can define a column importance order, the least important columns basically are hidden first.
 *
 *
 * ### Vertical treatment
 *
 * A sub row is added when the user clicks the toggle button for the first time, and removed when the user hits the
 * same toggle button a second time.
 *
 * The toggle button is shown only when at least one column has been hidden (by the horizontal treatment).
 *
 * A sub row is a row containing the same table cells as the source row, but stacked vertically instead
 * of horizontally (takes less horizontal space, which suits more small devices screen).
 * And all the tr of the sub row which are still present in the horizontal row are hidden in the vertical subrow, live.
 *
 *
 * Whenever the subrow is available, a column containing a toggler plus button is prepended to every row.
 *
 *
 *
 *
 * Implementation hint: why does the subrow disappear?
 * -------------
 * The trick below is somehow complex if you don't know what's going on, so here it is:
 * - When a subrow is expanded/created, it's all created inside a td (i.e. the content table is nested inside the unique td of the subrow).
 * - At the same time, when you resize the screen, if there is no column to hide, the first td|th of every row is hidden
 *          by the horizontal treatment (to remove/add the plus toggle button column).
 *
 * And so, when there is no column to hide, the subrow will disappear (i.e. it's hidden to be precise), because of that horizontal treatment.
 * So, that's why the subrow disappears.
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * Conception notes:
 * ---------
 * Ok, the redrawing of the columns went pretty smooth, it's pretty straight forward and doesn't
 * require much explanations: basically we just start by storing the initial width of the columns,
 * and then based on the available space (based on the width of the container of the table),
 * we hide/show them.
 *
 * Now for adding the tr below the column, I consider two approaches:
 * - lazy approach, create the markup only when the user clicks the plus button
 * - standard approach, create all the rows as the table is resized
 *
 * I will opt for the lazy approach, as I can't see any pitfalls,
 * and it leads to a faster gui (i.e. less dom manipulation).
 * If we want to add a toggle all button, then we can simply add a toggleAll function,
 * but unless an user clicks that button, we would benefit the speed of the lazy approach (vs the
 * more memory consuming standard approach).
 * For the implementation details, see below, it sounds pretty straight forward, and probably
 * doesn't require much explanations other than the code.
 * I'm using a colspan trick, seems to work in firefox and chrome (I don't know about ie, but it
 * might: https://stackoverflow.com/questions/398734/colspan-all-columns), that's pretty much it.
 *
 *
 *
 *
 *
 *
 *
 */
if ('undefined' === typeof ResponsiveTableHelper) {
    (function () {
        var $ = jQuery;


        window.ResponsiveTableHelper = function (options) {
            this.options = $.extend({}, window.ResponsiveTableHelper._defaults, options);
            this.jTable = this.options.jTable;
            this.jTableContainer = this.options.jTableContainer;
            if (null === this.jTableContainer) {
                this.jTableContainer = this.jTable.parent();
            }
        };
        window.ResponsiveTableHelper.prototype = {
            hideColumns: function (hideColumnIndexes) {
                this.jTable.find('tr').each(function () {
                    $(this).find('> th, > td').each(function (index) {
                        if (-1 !== hideColumnIndexes.indexOf(index)) {
                            $(this).hide();
                        } else {
                            $(this).show();
                        }
                    });
                });
            },
            /**
             * Adds a column BEFORE the given position (0-based index).
             * To append a column AFTER the last column, use position = null.
             *
             *
             * Note that the technique used is to clone the first cell of each tr (so that if
             * you have some special css class on them, we keep the style by default).
             *
             *
             * The content can be one of:
             *
             * - string: the html inner content of the cell.
             * - array:
             *      - 0: string, the html inner content of the cell if it's a th
             *      - 1: string, the html inner content of the cell if it's a td
             * - callback: function( jCell, jTr ) {}
             *              This callback returns the whole cell, including the wrapping td or th.
             *
             *
             *
             * @param position
             * @param content
             */
            addColumn: function (position, content) {


                this.jTable.find('tr').each(function () {
                    var jCells = $(this).find('> th, > td');
                    var nbColumns = jCells.length;


                    if (position > nbColumns - 1) {
                        position = nbColumns - 1;
                    }


                    var jClone = jCells.first().clone();

                    // prepend mode
                    if (null !== position) {
                        jCells.eq(position).before(jClone);
                    }
                    // append mode
                    else {
                        jCells.last().after(jClone);
                    }


                    if ('string' === typeof content) {
                        jClone.html(content);

                    } else if ('function' === typeof content) {
                        jClone.replaceWith(content(jClone, $(this)));
                    } else if ($.isArray(content)) {
                        var newContent;
                        if (true === jClone.is('th')) {
                            newContent = content[0];
                        } else {
                            newContent = content[1];
                        }
                        jClone.html(newContent);
                    }

                });
            },

            /**
             * Returns a map of column index (0-based) => width in pixel.
             *
             */
            getColumnMinWidths: function () {
                var colWidths = {};
                var jTr = this.jTable.find('tr').first();
                var jCells = jTr.find('> th, > td');
                jCells.each(function (index) {
                    colWidths[index] = $(this).outerWidth();
                });
                return colWidths;
            },
            /**
             * This is the only method we need to use for a normal use of this tool.
             *
             * It prepares the table for responsiveness.
             *
             */
            listen: function () {


                var $this = this;
                this.originalAvailableWidth = this.jTableContainer.outerWidth();
                var labels = this.options.columnLabels;
                if ('auto' === labels) {
                    labels = [];
                    var jTr = this.jTable.find("tr:first");
                    if (jTr.length) {
                        jTr.find('> th, > td').each(function () {
                            labels.push($(this).text().trim());
                        });
                    }
                    this.options.columnLabels = labels;
                }


                /**
                 * Let's first add the column holding the plus buttons.
                 * We'll hide it later maybe if not used, but at least I want it to be
                 * considered in my resize computations.
                 *
                 */
                this.addColumn(0, this.options.extraColumnContent);

                this.initWindowWidth = $(window).width();
                this.minWidths = this.getColumnMinWidths();

                var padding = this.options.padding;
                if ('auto' === padding) {
                    for (var i in this.minWidths) {
                        padding = this.minWidths[i];
                    }
                }
                this.originalAvailableWidth -= padding;


                // the available width is dynamic, it's calculated as the window is resized.
                this.availableWidth = $this.originalAvailableWidth;
                this.columnsTotalWidth = this.sum(this.minWidths);


                //----------------------------------------
                // redrawing
                //----------------------------------------
                if (this.availableWidth < this.columnsTotalWidth) {
                    this.redraw();
                }
                $(window).on('resize', function () {
                    var windowNewSize = $(this).width();
                    var sizeOffset = $this.initWindowWidth - windowNewSize;
                    $this.availableWidth = $this.originalAvailableWidth - sizeOffset;
                    $this.redraw();
                });

                this.jTable.on('click', '.rth-toggle-button', function () {
                    var jTr = $(this).closest('tr');

                    if (false === jTr.hasClass('rth-expanded-row')) {
                        jTr.addClass('rth-expanded-row');
                        $this.addSubRow(jTr);
                    } else {
                        jTr.removeClass('rth-expanded-row');
                        $this.removeSubRow(jTr);
                    }
                    return false;
                });

            },
            /**
             * Adds a sub row (if it doesn't exist already) below the given tr jquery object.
             *
             * @param jTr
             */
            addSubRow: function (jTr) {
                // add the row only if it doesn't exist already
                var jNextTr = jTr.next('tr');
                if (jNextTr.length && jNextTr.hasClass('rth-sub-row')) {
                    return;
                }

                $this = this;
                var s = '';
                s += '<table>';
                jTr.find('> td').not(":first").each(function (index) {

                    var sStyle = '';
                    if (
                        -1 !== $this.options.expandedColumnFilterIndexes.indexOf(index) ||
                        -1 === $this.columnsToHide.indexOf(index + 1)
                    ) {
                        sStyle = 'style="display: none"';
                    }


                    s += '<tr ' + sStyle + '>';
                    var content = $(this).html();
                    var label = $this.options.columnLabels[index];
                    s += '<td>' + label + '</td>';
                    s += '<td>' + content + '</td>';
                    s += '</tr>';
                });
                s += '</table>';

                // colspan trick here: might not be optimal in every browser, but should work in most browsers
                var jContentTr = $('<tr class="rth-sub-row"><td colspan="999">' + s + '</td></tr>');
                jTr.after(jContentTr);
            },
            /**
             * Removes the subrow of the given tr jquery object.
             * @param jTr
             */
            removeSubRow: function (jTr) {
                var jNextTr = jTr.next('tr');
                if (jNextTr.length && jNextTr.hasClass('rth-sub-row')) {
                    jNextTr.remove();
                }
            },
            /**
             * This method is called many times very rapidly (i.e. on every resize triggered event).
             * It basically redraws the rows of the table, according to the available width.
             * The extra column containing the plus toggler will be added/removed depending on whether the table
             * has been cut.
             *
             */
            redraw: function () {

                var $this = this;
                var collapsibleColumnIndexes = this.options.collapsibleColumnIndexes.slice();
                var columnsTotalWidth = parseInt(this.columnsTotalWidth);
                var columnsToShow = Object.keys(this.minWidths).map(function (x) {
                    return parseInt(x, 10);
                });
                var columnsToHide = [];

                /**
                 * Find the columns to hide
                 */
                while (this.availableWidth < columnsTotalWidth) {
                    var nextColumnToCollapse = collapsibleColumnIndexes.shift();
                    if ('undefined' === typeof nextColumnToCollapse) {
                        break;
                    }

                    nextColumnToCollapse += 1;

                    if (nextColumnToCollapse in this.minWidths) {
                        columnsTotalWidth -= this.minWidths[nextColumnToCollapse];
                        columnsToHide.push(nextColumnToCollapse);
                        this.removeByValue(columnsToShow, nextColumnToCollapse);

                    } else {
                        this.error("The column with index " + nextColumnToCollapse + " was not defined in minWidths.");
                    }
                }


                // no columns to hide?
                var hasColumnsToExpand = true;
                if (0 === columnsToHide.length) {
                    hasColumnsToExpand = false;
                } else {
                    var columnsToHideCopy = columnsToHide.filter(function (e) {
                        /**
                         * I add +1 because the expandedColumnFilterIndexes starts with 0 based on the
                         * user provided data, whereas columnsToHide's 0 is the toggle column with the plus button.
                         */
                        return (-1 === $this.options.expandedColumnFilterIndexes.indexOf(e - 1));
                    });

                    if (0 === columnsToHideCopy.length) {
                        hasColumnsToExpand = false;
                    }
                }

                if (false === hasColumnsToExpand) {
                    columnsToHide.push(0);
                }


                this.columnsToHide = columnsToHide; // transmit data for the vertical treatment


                /**
                 * Now redraw the html
                 */
                this.hideColumns(columnsToHide);

                /**
                 * Now resize opened subrows
                 */
                this.jTable.find('.rth-sub-row').each(function () {
                    $(this).find('tr').each(function (index) {
                        if (
                            -1 !== $this.options.expandedColumnFilterIndexes.indexOf(index) ||
                            -1 === columnsToHide.indexOf(index + 1)
                        ) {
                            $(this).hide();
                        } else {
                            $(this).show();
                        }
                    });
                });


            },
            /**
             * Remove the entry of arr if the given value match the entry's value.
             *
             * @param arr
             * @param value
             */
            removeByValue: function (arr, value) {
                var index = arr.indexOf(value);
                if (index !== -1) {
                    arr.splice(index, 1);
                }
            },
            sum: function (arrObj) {
                var sum = 0;
                for (var i in arrObj) {
                    sum += arrObj[i];
                }
                return sum;
            },
        };


        //----------------------------------------
        //
        //----------------------------------------
        window.ResponsiveTableHelper._defaults = {
            /**
             * The jquery element holding the table. This is mandatory.
             */
            jTable: null,
            /**
             * The jquery element holding the container of the table.
             * If not set, the parent of the jTable element will be used.
             * The table container is used to calculate the available width (for the table to breathe in).
             */
            jTableContainer: null,
            /**
             * number, the 0-based index representing the row at which the content starts (the content being the rows potentially being resized).
             * Note: every row (even those in the headers) are taken into consideration.
             */
            contentRowStartIndex: 0,
            /**
             * The content of the column added by this tool.
             * See the addColumn method for more details.
             *
             * The ".rth-toggle-button" css class MUST be added to your markup on the element that will
             * be use to toggle between the collapsed and expanded states.
             */
            extraColumnContent: '<a href="#" class="rth-toggle-button"<i class="fas fa-plus-circle"></i></a>',
            /**
             * An array of the indexes (0-based) of the columns to collapse in decreasing priority order (i.e.
             * the first index in the array will be the first column to collapse).
             *
             * Note: the 0 index is your first column (i.e the column added by this tool, which contains a plus button,
             * doesn't count).
             *
             * Any column not listed in this array WILL NOT collapse.
             * This gives us the ability so be really flexible about which column to show/hide.
             *
             *
             * Note: from my experience I had better results removing the columns from the right
             * side to the left rather than from left to right. Therefore I can only recommend that
             * developer consider putting the non-important data to the right in the first place
             * (makes more semantic sense anyway at least ltr readers), and use this array
             * by putting higher index first...
             *
             */
            collapsibleColumnIndexes: [],
            /**
             * When the user clicks the toggle button to expand a row, the generated subrow will by default display
             * all the collapsed columns.
             *
             * By using this option, you can further filter those collapsed columns, useful if you don't want to display
             * a checkbox column for instance.
             *
             * The 0 index represents your first column (i.e. the extra column added by this tool and containing the plus toggle doesn't count)
             */
            expandedColumnFilterIndexes: [],
            /**
             * @param auto: array|auto
             * The labels of the columns. This will be used in the extra content rows generated below the table rows
             * when the table is shrunk down.
             *
             * If you use the auto value, this tool will use the text (jquery.text function) of your table's first row
             * as labels. Otherwise, you need to specify them manually.
             *
             *
             */
            columnLabels: 'auto',
            /**
             *
             * @param padding, int|auto.
             *
             * A secure padding to add to the available width (in the computation algorithm).
             * Basically the more padding you add, the less likely you are going to have a column
             * split by the right side of your window.
             * The "auto" special value will automatically set the value to the width of the last column.
             */
            padding: "auto",
        };
    })();
}