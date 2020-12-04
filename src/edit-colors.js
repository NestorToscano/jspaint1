// @TODO:
// - Persist custom colors list? it's not very persistent in real Windows...
// - Keyboard navigation of the color cells
//   - consistent behavior of arrow keys (should probably store the colors in the same way for each grid)
//   - tab should go to next control, not next cell
// - OK with Enter, after selecting a focused color if applicable 
// - https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/Grid_Role
//   or https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/listbox_role
// - Question mark button in titlebar that lets you click on parts of UI to ask about them; also context menu "What's this?"

// In Windows, the Hue goes from 0 to 239 (240 being equivalent to 0), and Sat and Lum go from 0 to 240
// I think people are more familiar with degrees and percentages, so I don't think I'll be implementing that.

// Development workflow:
// - In the console, set localStorage.dev_edit_colors = "true";
// - Reload the page
// - Load a screenshot of the Edit Colors window into the editor
// - Position it finely using the arrow keys on a selection
// - For measuring positions, look at the Windows source code OR:
//   - close the window,
//   - point on the canvas, mark down the coordinates shown in status bar,
//   - point on the canvas at the origin
//     - the top left of the inside of the window, or
//     - the top left of (what corresponds to) the nearest parent position:fixed/absolute/relative
//   - subtract the origin from the target

let $edit_colors_window;

let dev_edit_colors = false;
try {
	dev_edit_colors = localStorage.dev_edit_colors === "true";
	// eslint-disable-next-line no-empty
} catch (error) { }
if (dev_edit_colors) {
	$(()=> {
		show_edit_colors_window();
		$(".expando-button").click();
		$edit_colors_window.css({
			left: 80,
			top: 50,
			opacity: 0.5,
		});
	});
}

function show_edit_colors_window($swatch_to_edit, color_selection_slot_to_edit) {
	// console.log($swatch_to_edit, $colorbox.data("$last_fg_color_button"));
	$swatch_to_edit = $swatch_to_edit || $colorbox.data("$last_fg_color_button");
	color_selection_slot_to_edit = color_selection_slot_to_edit || "foreground";

	const initial_color = $swatch_to_edit[0].dataset.color;

	if ($edit_colors_window) {
		$edit_colors_window.close();
	}
	const $w = new $FormToolWindow("Edit Colors");
	$w.addClass("edit-colors-window");
	$edit_colors_window = $w;

	let hue_degrees = 0;
	let sat_percent = 50;
	let lum_percent = 50;

	let custom_colors_index = 0;

	const get_current_color = ()=> `hsl(${hue_degrees}deg, ${sat_percent}%, ${lum_percent}%)`;
	const set_color_from_rgb = (r, g, b)=> {
		const [h, s, l] = rgb_to_hsl(r, g, b);
		hue_degrees = h * 360;
		sat_percent = s * 100;
		lum_percent = l * 100;
	};
	const set_color = (color)=> {
		const [r, g, b] = get_rgba_from_color(color);
		set_color_from_rgb(r, g, b);
	};
	const select = ($swatch)=> {
		$w.$content.find(".swatch").removeClass("selected");
		$swatch.addClass("selected");
		set_color($swatch[0].dataset.color);
		if ($swatch.closest("#custom-colors")) {
			custom_colors_index = Math.max(0, $custom_colors_grid.find(".swatch").toArray().indexOf(
				$custom_colors_grid.find(".swatch.selected")[0]
			));
		}
		update_inputs("hslrgb");
	};

	// misnomer: using .menu-hotkey out of lazyness
	const underline_hotkey = str => str.replace(/&(.)/, m => `<span class='menu-hotkey'>${m[1]}</span>`);
	// const text_without_hotkey = str => str.replace(/&/, "");
	// const get_hotkey = str => str[str.indexOf("&")+1].toUpperCase();

	const make_color_grid = (colors, id)=> {
		const $color_grid = $(`<div class="color-grid" tabindex="0">`).attr({id});
		for (const color of colors) {
			const $swatch = $Swatch(color);
			$swatch.appendTo($color_grid).addClass("inset-deep");
			$swatch.attr("tabindex", 0);
		}
		let $local_last_focus = $color_grid.find(".swatch:first-child");
		const num_colors_per_row = 8;
		const navigate = (relative_index)=> {
			const $focused = $color_grid.find(".swatch:focus");
			if (!$focused.length) { return; }
			const $swatches = $color_grid.find(".swatch");
			const from_index = $swatches.toArray().indexOf($focused[0]);
			if (relative_index === -1 && (from_index % num_colors_per_row) === 0) { return; }
			if (relative_index === +1 && (from_index % num_colors_per_row) === num_colors_per_row - 1) { return; }
			const to_index = from_index + relative_index;
			const $to_focus = $($swatches.toArray()[to_index]);
			// console.log({from_index, to_index, $focused, $to_focus});
			if (!$to_focus.length) { return; }
			$to_focus.focus();
		};
		$color_grid.on("keydown", (event)=> {
			// console.log(event.code);
			if (event.code === "ArrowRight") { navigate(+1); }
			if (event.code === "ArrowLeft") { navigate(-1); }
			if (event.code === "ArrowDown") { navigate(+num_colors_per_row); }
			if (event.code === "ArrowUp") { navigate(-num_colors_per_row); }
			if (event.code === "Home") { $color_grid.find(".swatch:first-child").focus(); }
			if (event.code === "End") { $color_grid.find(".swatch:last-child").focus(); }
			if (event.code === "Space" || event.code === "Enter") {
				select($color_grid.find(".swatch:focus"));
				draw();
			}
		});
		$color_grid.on("pointerdown", (event)=> {
			const $swatch = $(event.target).closest(".swatch");
			if ($swatch.length) {
				select($swatch);
				draw();
			}
		});
		$color_grid.on("dragstart", (event)=> {
			event.preventDefault();
		});
		$color_grid.on("focusin", (event)=> {
			if (event.target.closest(".swatch")) {
				$local_last_focus = $(event.target.closest(".swatch"));
			} else {
				if (!$local_last_focus.is(":focus")) { // prevent infinite recursion
					$local_last_focus.focus();
				}
			}
		});
		return $color_grid;
	};
	const $left_right_split = $(`<div class="left-right-split">`).appendTo($w.$main);
	const $left = $(`<div class="left-side">`).appendTo($left_right_split);
	const $right = $(`<div class="right-side">`).appendTo($left_right_split).hide();
	$left.append(`<label for="basic-colors">${underline_hotkey("&Basic colors:")}</label>`);
	const $basic_colors_grid = make_color_grid(basic_colors, "basic-colors").appendTo($left);
	$left.append(`<label for="custom-colors">${underline_hotkey("&Custom colors:")}</label>`);
	const $custom_colors_grid = make_color_grid(custom_colors, "custom-colors").appendTo($left);

	const $expando_button = $(`<button class="expando-button">`)
	.html(underline_hotkey("&Define Custom Colors >>"))
	.appendTo($left)
	.on("click", ()=> {
		$right.show();
		$expando_button.attr("disabled", "disabled");
		inputs_by_component_letter.h.focus();
	});

	const $color_solid_label = $(`<label for="color-solid-canvas">${underline_hotkey("Color|S&olid")}</label>`);
	$color_solid_label.css({
		position: "absolute",
		left: 10,
		top: 244,
	});

	const rainbow_canvas = make_canvas(175, 187);
	const luminosity_canvas = make_canvas(10, 187);
	const result_canvas = make_canvas(58, 40);
	const lum_arrow_canvas = make_canvas(5, 9);
	
	let mouse_down_on_rainbow_canvas = false;
	let crosshair_shown_on_rainbow_canvas = false;
	const draw = ()=> {
		if (!mouse_down_on_rainbow_canvas || crosshair_shown_on_rainbow_canvas) {
			// rainbow
			for (let y = 0; y < rainbow_canvas.height; y += 6) {
				for (let x = -1; x < rainbow_canvas.width; x += 3) {
					rainbow_canvas.ctx.fillStyle = `hsl(${x/rainbow_canvas.width*360}deg, ${(1-y/rainbow_canvas.height)*100}%, 50%)`;
					rainbow_canvas.ctx.fillRect(x, y, 3, 6);
				}
			}
			// crosshair
			if (!mouse_down_on_rainbow_canvas) {
				const x = ~~(hue_degrees/360*rainbow_canvas.width);
				const y = ~~((1-sat_percent/100)*rainbow_canvas.height);
				rainbow_canvas.ctx.fillStyle = "black";
				rainbow_canvas.ctx.fillRect(x-1, y-9, 3, 5);
				rainbow_canvas.ctx.fillRect(x-1, y+5, 3, 5);
				rainbow_canvas.ctx.fillRect(x-9, y-1, 5, 3);
				rainbow_canvas.ctx.fillRect(x+5, y-1, 5, 3);
			}
			crosshair_shown_on_rainbow_canvas = !mouse_down_on_rainbow_canvas;
		}

		for (let y = -2; y < luminosity_canvas.height; y += 6) {
			luminosity_canvas.ctx.fillStyle = `hsl(${hue_degrees}deg, ${sat_percent}%, ${(1-y/luminosity_canvas.height)*100}%)`;
			luminosity_canvas.ctx.fillRect(0, y, luminosity_canvas.width, 6);
		}

		lum_arrow_canvas.ctx.fillStyle = getComputedStyle($w.$content[0]).getPropertyValue("--ButtonText");
		for (let x = 0; x < lum_arrow_canvas.width; x++) {
			lum_arrow_canvas.ctx.fillRect(x, lum_arrow_canvas.width-x-1, 1, 1+x*2);
		}
		lum_arrow_canvas.style.position = "absolute";
		lum_arrow_canvas.style.right = "7px";
		lum_arrow_canvas.style.top = `${3 + ~~((1-lum_percent/100)*luminosity_canvas.height)}px`;

		result_canvas.ctx.fillStyle = get_current_color();
		result_canvas.ctx.fillRect(0, 0, result_canvas.width, result_canvas.height);
	};
	draw();
	$(rainbow_canvas).addClass("rainbow-canvas inset-shallow");
	$(luminosity_canvas).addClass("luminosity-canvas inset-shallow");
	$(result_canvas).addClass("result-color-canvas inset-shallow").attr("id", "color-solid-canvas");

	const select_hue_sat = (event)=> {
		hue_degrees = Math.min(1, Math.max(0, event.offsetX/rainbow_canvas.width))*360;
		sat_percent = Math.min(1, Math.max(0, (1 - event.offsetY/rainbow_canvas.height)))*100;
		update_inputs("hsrgb");
		draw();
		event.preventDefault();
	};
	$(rainbow_canvas).on("pointerdown", (event)=> {
		mouse_down_on_rainbow_canvas = true;
		select_hue_sat(event);
		
		$(rainbow_canvas).on("pointermove", select_hue_sat);
		rainbow_canvas.setPointerCapture(event.pointerId);
	});
	$G.on("pointerup pointercancel", (event)=> {
		$(rainbow_canvas).off("pointermove", select_hue_sat);
		// rainbow_canvas.releasePointerCapture(event.pointerId);
		mouse_down_on_rainbow_canvas = false;
		draw();
	});

	const select_lum = (event)=> {
		lum_percent = Math.min(1, Math.max(0, (1 - event.offsetY/luminosity_canvas.height)))*100;
		update_inputs("lrgb");
		draw();
		event.preventDefault();
	};
	$(luminosity_canvas).on("pointerdown", (event)=> {
		select_lum(event);
		
		$(luminosity_canvas).on("pointermove", select_lum);
		luminosity_canvas.setPointerCapture(event.pointerId);
	});
	$G.on("pointerup pointercancel", (event)=> {
		$(luminosity_canvas).off("pointermove", select_lum);
		// luminosity_canvas.releasePointerCapture(event.pointerId);
	});

	const inputs_by_component_letter = {};

	["hsl", "rgb"].forEach((color_model, color_model_index)=> {
		[...color_model].forEach((component_letter, component_index)=> {
			const text_with_hotkey = {
				h: "Hu&e:",
				s: "&Sat:",
				l: "&Lum:",
				r: "&Red:",
				g: "&Green:",
				b: "Bl&ue:",
			}[component_letter];
			const input = document.createElement("input");
			// not doing type="number" because the inputs have no up/down buttons and they have special behavior with validation
			input.type = "text";
			input.classList.add("inset-deep");
			input.dataset.componentLetter = component_letter;
			input.dataset.min = 0;
			input.dataset.max = {
				h: 360,
				s: 100,
				l: 100,
				r: 255,
				g: 255,
				b: 255,
			}[component_letter];
			const label = document.createElement("label");
			label.innerHTML = underline_hotkey(text_with_hotkey);
			const input_y_spacing = 22;
			$(label).css({
				position: "absolute",
				left: 63 + color_model_index * 80,
				top: 202 + component_index * input_y_spacing,
				textAlign: "right",
				width: 40,
				height: 20,
				lineHeight: "20px",
			});
			$(input).css({
				position: "absolute",
				left: 106 + color_model_index * 80,
				top: 202 + component_index * input_y_spacing + (component_index > 1), // spacing of rows is uneven by a pixel
				width: 21,
				height: 14,
			});
			$right.append(label, input);

			inputs_by_component_letter[component_letter] = input;
		});
	});

	// listening for input events on input elements using event delegation (looks a little weird)
	$right.on("input", "input", (event)=> {
		const input = event.target;
		const component_letter = input.dataset.componentLetter;
		if (component_letter) {
			// In Windows, it actually only updates if the numerical value changes, not just the text.
			// That is, you can add leading zeros, and they'll stay, then add them in the other color model
			// and it won't remove the ones in the fields of the first color model.
			// This is not important, so I don't know if I'll do that.

			if (input.value.match(/^\d+$/)) {
				let n = Number(input.value);
				if (n < input.dataset.min) {
					n = input.dataset.min;
					input.value = n;
				} else if (n > input.dataset.max) {
					n = input.dataset.max;
					input.value = n;
				}
				if ("hsl".indexOf(component_letter) > -1) {
					switch (component_letter) {
						case "h":
							hue_degrees = n;
							break;
						case "s":
							sat_percent = n;
							break;
						case "l":
							lum_percent = n;
							break;
					}
					update_inputs("rgb");
				} else {
					let [r, g, b] = get_rgba_from_color(get_current_color());
					const rgb = {r, g, b};
					rgb[component_letter] = n;
					set_color_from_rgb(rgb.r, rgb.g, rgb.b);
					update_inputs("hsl");
				}
				draw();
			} else if (input.value.length) {
				update_inputs(component_letter);
				input.select();
			}
		}
	});
	$right.on("focusout", "input", (event)=> {
		const input = event.target;
		const component_letter = input.dataset.componentLetter;
		if (component_letter) {
			// Handle empty input when focus moves away
			if (!input.value.match(/^\d+$/)) {
				update_inputs(component_letter);
				input.select();
			}
		}
	});

	$w.on("keydown", (event)=> {
		if (event.altKey) {
			switch (event.key) {
				case "o":
					set_color(get_current_color());
					update_inputs("hslrgb");
					draw();
					break;
				case "b":
					$basic_colors_grid.find(".swatch.selected, .swatch").focus();
					break;
				case "c":
					$basic_colors_grid.find(".swatch.selected, .swatch").focus();
					break;
				case "e":
					inputs_by_component_letter.h.focus();
					break;
				case "s":
					inputs_by_component_letter.s.focus();
					break;
				case "l":
					inputs_by_component_letter.l.focus();
					break;
				case "r":
					inputs_by_component_letter.r.focus();
					break;
				case "g":
					inputs_by_component_letter.g.focus();
					break;
				case "u":
					inputs_by_component_letter.b.focus();
					break;
				case "a":
					if ($add_to_custom_colors_button.is(":visible")) { 
						$add_to_custom_colors_button.click();
					}
					break;
				case "d":
					$expando_button.click();
					break;
				default:
					return; // don't prevent default by default
			}
		} else {
			return; // don't prevent default by default
		}
		event.preventDefault();
		event.stopPropagation();
	});

	const update_inputs = (components)=> {
		for (const component_letter of components) {
			const input = inputs_by_component_letter[component_letter];
			const [r, g, b] = get_rgba_from_color(get_current_color());
			input.value = Math.floor({
				h: hue_degrees,
				s: sat_percent,
				l: lum_percent,
				r,
				g,
				b,
			}[component_letter]);
		}
	};

	$right.append(rainbow_canvas, luminosity_canvas, result_canvas, $color_solid_label, lum_arrow_canvas);

	const $add_to_custom_colors_button = $(`<button class="add-to-custom-colors-button">`)
	.html(underline_hotkey("&Add To Custom Colors"))
	.appendTo($right)
	.on("click", (event)=> {
		const color = get_current_color();
		custom_colors[custom_colors_index] = color;
		// console.log($custom_colors_grid.find(".swatch"), custom_colors_index, $($custom_colors_grid.find(".swatch")[custom_colors_index]));
		$($custom_colors_grid.find(".swatch")[custom_colors_index]).data("update")(color);
		custom_colors_index = (custom_colors_index + 1) % custom_colors.length;
		event.preventDefault(); // prevent form submit
	});

	$w.$Button("OK", () => {
		const color = get_current_color();
		// console.log($swatch_to_edit, $swatch_to_edit.data("update"));
		$swatch_to_edit.data("update")(color);
		colors[color_selection_slot_to_edit] = color;
		$G.triggerHandler("option-changed");
		$w.close();
	})[0].focus();
	$w.$Button("Cancel", () => {
		$w.close();
	});

	$left.append($w.$buttons);

	// initially select the first color cell that matches the swatch to edit, if any
	// (first in the basic colors, then in the custom colors otherwise - implicitly)
	for (const swatch_el of $left.find(".swatch").toArray()) {
		if (get_rgba_from_color(swatch_el.dataset.color).join(",") === get_rgba_from_color(initial_color).join(",")) {
			select($(swatch_el));
			swatch_el.focus();
			break;
		}
	}
	custom_colors_index = Math.max(0, $custom_colors_grid.find(".swatch").toArray().indexOf(
		$custom_colors_grid.find(".swatch.selected")[0]
	));
	
	set_color(initial_color);
	update_inputs("hslrgb");

	$w.center();
}
