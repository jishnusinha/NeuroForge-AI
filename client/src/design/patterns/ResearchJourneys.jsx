import {Link} from 'react-router-dom';
import {PrismButton} from '../components/Prism.jsx';
export default function ResearchJourneys(){return <section aria-label="Research journeys"><div className="prism-ui-journeys">{[
  {title:'Explore and prepare data',description:'Import a CSV or try the seeded sample. Review quality, edit a working copy and inspect reproducible charts.',path:'/app/datasets',action:'Explore datasets'},
  {title:'Build and understand models',description:'Fit preprocessing on training data, evaluate a candidate, and inspect its predictions and explanations.',path:'/app/datasets?stage=modeling',action:'Open model workflow'},
  {title:'Compare research evidence',description:'Compare compatible saved validation results and inspect recorded cross-validation with source provenance.',path:'/app/experiments?view=research',action:'Open Research Intelligence'},
].map(journey=><article className="prism-ui-journey" key={journey.path}><h3>{journey.title}</h3><p>{journey.description}</p><PrismButton as={Link} to={journey.path}>{journey.action}</PrismButton></article>)}</div></section>;}
