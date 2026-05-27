<script lang="ts">
	// Layout shell. Backend scaffolds src/app.css with the family palette
	// and base reset, but SvelteKit only applies CSS that is *imported* —
	// nothing in the scaffold imports it, so wiring it up is part of the
	// frontend slice. fonts.css comes second so its :root override of
	// --display / --mono lands on top of the scaffold defaults.
	import '../app.css';
	import '$lib/fonts.css';

	let { children } = $props();
</script>

{@render children()}
